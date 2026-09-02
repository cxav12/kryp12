<?php

declare(strict_types=1);

function retailerFromHost(string $host): string
{
    $host = preg_replace('/^www\./', '', strtolower($host));
    $known = [
        'amazon.com' => 'Amazon',
        'bestbuy.com' => 'Best Buy',
        'target.com' => 'Target',
        'walmart.com' => 'Walmart',
        'bhphotovideo.com' => 'B&H Photo Video',
        'dji.com' => 'DJI',
    ];
    foreach ($known as $domain => $name) {
        if ($host === $domain || str_ends_with($host, '.' . $domain)) return $name;
    }
    $label = explode('.', $host)[0] ?: $host;
    return ucwords(str_replace(['-', '_'], ' ', $label));
}

function fetchProductPage(string $initialUrl): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('Automatic retrieval is unavailable. Enter the product details manually.');
    }
    $url = $initialUrl;
    for ($redirects = 0; $redirects <= 5; $redirects++) {
        $target = validatedRemoteUrl($url);
        $parts = parse_url($target['url']);
        $port = (int) ($parts['port'] ?? ($parts['scheme'] === 'https' ? 443 : 80));
        $body = '';
        $headers = [];
        $handle = curl_init($target['url']);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'Kryp12 Wishlist/1.0',
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
            CURLOPT_RESOLVE => [sprintf('%s:%d:%s', $target['host'], $port, $target['addresses'][0])],
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$headers): int {
                $length = strlen($line);
                $position = strpos($line, ':');
                if ($position !== false) {
                    $headers[strtolower(trim(substr($line, 0, $position)))] = trim(substr($line, $position + 1));
                }
                return $length;
            },
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body): int {
                if (strlen($body) + strlen($chunk) > 2_000_000) return 0;
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $success = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $contentType = strtolower((string) curl_getinfo($handle, CURLINFO_CONTENT_TYPE));
        $error = curl_error($handle);
        curl_close($handle);

        if ($status >= 300 && $status < 400 && isset($headers['location'])) {
            $url = resolveUrl($target['url'], $headers['location']) ?? '';
            continue;
        }
        if ($success === false || $status < 200 || $status >= 300) {
            throw new RuntimeException($error ?: "The retailer returned HTTP {$status}.");
        }
        if (!str_contains($contentType, 'text/html') && !str_contains($contentType, 'application/xhtml+xml')) {
            throw new RuntimeException('The product address did not return an HTML page.');
        }
        return ['url' => $target['url'], 'html' => $body, 'host' => $target['host']];
    }
    throw new RuntimeException('The product address redirected too many times.');
}

function firstXpathValue(DOMXPath $xpath, array $queries): ?string
{
    foreach ($queries as $query) {
        $nodes = $xpath->query($query);
        if ($nodes && $nodes->length) {
            $value = trim((string) ($nodes->item(0)->nodeValue ?? ''));
            if ($value !== '') return html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }
    }
    return null;
}

function productSchema(array $value): ?array
{
    if (($value['@type'] ?? null) === 'Product' || in_array('Product', (array) ($value['@type'] ?? []), true)) return $value;
    foreach ($value as $child) {
        if (is_array($child)) {
            $found = productSchema($child);
            if ($found) return $found;
        }
    }
    return null;
}

function importProduct(string $url): array
{
    $validated = validatedRemoteUrl($url);
    $result = [
        'title' => '', 'image_url' => '', 'price' => '', 'retailer' => retailerFromHost($validated['host']),
        'product_url' => $validated['url'], 'description' => '', 'import_message' => '',
    ];
    try {
        $page = fetchProductPage($validated['url']);
        libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $document->loadHTML($page['html'], LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        $xpath = new DOMXPath($document);
        $schema = null;
        foreach ($xpath->query('//script[@type="application/ld+json"]') ?: [] as $node) {
            $decoded = json_decode((string) $node->nodeValue, true);
            if (is_array($decoded) && ($schema = productSchema($decoded))) break;
        }
        $offer = $schema['offers'] ?? [];
        if (isset($offer[0])) $offer = $offer[0];
        $schemaImage = $schema['image'] ?? '';
        if (is_array($schemaImage)) $schemaImage = $schemaImage['url'] ?? $schemaImage[0] ?? '';
        $result['title'] = (string) ($schema['name'] ?? firstXpathValue($xpath, ['//meta[@property="og:title"]/@content', '//title']) ?? '');
        $result['description'] = (string) ($schema['description'] ?? firstXpathValue($xpath, ['//meta[@property="og:description"]/@content', '//meta[@name="description"]/@content']) ?? '');
        $result['image_url'] = (string) ($schemaImage ?: firstXpathValue($xpath, ['//meta[@property="og:image"]/@content']) ?? '');
        $result['price'] = (string) ($offer['price'] ?? firstXpathValue($xpath, ['//meta[@property="product:price:amount"]/@content']) ?? '');
        $canonical = firstXpathValue($xpath, ['//link[@rel="canonical"]/@href']);
        if ($canonical) $result['product_url'] = resolveUrl($page['url'], $canonical) ?? $page['url'];
        if ($result['image_url']) $result['image_url'] = resolveUrl($page['url'], $result['image_url']) ?? '';
        $result['retailer'] = retailerFromHost($page['host']);
        $result['import_message'] = 'Product details were retrieved. Review them before saving.';
    } catch (Throwable $error) {
        $result['import_message'] = 'Automatic retrieval was incomplete. Enter or correct the details below.';
    }
    return $result;
}
