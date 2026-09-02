<?php

declare(strict_types=1);

function normalizeHttpUrl(string $url): ?string
{
    $url = trim($url);
    if ($url === '' || strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return null;
    }
    $parts = parse_url($url);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
    if (!in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
        return null;
    }
    return $url;
}

function publicAddressesForHost(string $host): array
{
    if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
        return [];
    }
    $addresses = [];
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $addresses[] = $host;
    } elseif (function_exists('dns_get_record')) {
        $records = @dns_get_record($host, DNS_A | DNS_AAAA) ?: [];
        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;
            if ($address) {
                $addresses[] = $address;
            }
        }
    } else {
        $resolved = gethostbyname($host);
        if ($resolved !== $host) {
            $addresses[] = $resolved;
        }
    }
    $addresses = array_values(array_unique($addresses));
    foreach ($addresses as $address) {
        if (!filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return [];
        }
    }
    return $addresses;
}

function validatedRemoteUrl(string $url): array
{
    $normalized = normalizeHttpUrl($url);
    if ($normalized === null) {
        throw new InvalidArgumentException('Enter a valid HTTP or HTTPS product URL.');
    }
    $parts = parse_url($normalized);
    $host = strtolower((string) $parts['host']);
    $addresses = publicAddressesForHost($host);
    if (!$addresses) {
        throw new InvalidArgumentException('That address cannot be retrieved from this server.');
    }
    return ['url' => $normalized, 'host' => $host, 'addresses' => $addresses];
}

function resolveUrl(string $base, string $candidate): ?string
{
    $candidate = trim($candidate);
    if ($candidate === '') return null;
    if (normalizeHttpUrl($candidate)) return $candidate;
    if (str_starts_with($candidate, '//')) {
        return (parse_url($base, PHP_URL_SCHEME) ?: 'https') . ':' . $candidate;
    }
    $parts = parse_url($base);
    if (!isset($parts['scheme'], $parts['host'])) return null;
    $origin = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if (str_starts_with($candidate, '/')) return $origin . $candidate;
    $path = (string) ($parts['path'] ?? '/');
    $directory = rtrim(str_replace('\\', '/', dirname($path)), '/');
    return $origin . ($directory ? $directory . '/' : '/') . $candidate;
}
