<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, max-age=0');
$sites=['yankees'=>true,'palworld'=>true,'wishlist'=>false,'ravens'=>false];
try{$configFile=__DIR__.'/../wishlist/config.php';if(is_file($configFile)){$config=require $configFile;require_once __DIR__.'/../wishlist/app/database.php';foreach(db()->query('SELECT site_key,is_visible FROM site_visibility')->fetchAll() as $row)$sites[$row['site_key']]=(bool)$row['is_visible'];}}catch(Throwable $e){}
echo json_encode(['sites'=>$sites],JSON_UNESCAPED_SLASHES);
