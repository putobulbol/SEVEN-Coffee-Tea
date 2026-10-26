<?php
/**
 * Local Gmail SMTP settings for XAMPP.
 *
 * Copy this file to api/mail-config.local.php and replace the example values.
 * Never commit mail-config.local.php or share your Google App Password.
 */
return [
    'host' => 'smtp.gmail.com',
    'port' => 587,
    'username' => 'coffeeseven47@gmail.com',
    'password' => 'jsyirroeuvkdsqlj',
    'from' => 'coffeeseven47@gmail.com',
    'from_name' => 'SEVEN Coffee & Tea',
    'secure' => 'tls', // Use "tls" for port 587 or "ssl" for port 465.
];
