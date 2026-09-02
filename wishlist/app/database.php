<?php

declare(strict_types=1);

function db(): PDO
{
    static $connection;
    global $config;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $database = $config['database'] ?? [];
    $host = (string) ($database['host'] ?? 'localhost');
    $port = (int) ($database['port'] ?? 3306);
    $name = (string) ($database['name'] ?? '');
    $charset = (string) ($database['charset'] ?? 'utf8mb4');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

    $connection = new PDO($dsn, (string) ($database['username'] ?? ''), (string) ($database['password'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $connection;
}
