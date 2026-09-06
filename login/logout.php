<?php
declare(strict_types=1);
require __DIR__.'/../account-app/bootstrap.php';
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);exit('Method not allowed.');}
requireAccountCsrf();accountLogout();header('Location: /',true,303);
