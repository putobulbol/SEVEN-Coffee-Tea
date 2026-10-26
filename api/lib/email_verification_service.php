<?php
declare(strict_types=1);
use PHPMailer\PHPMailer\PHPMailer;

class SevenVerificationServiceException extends RuntimeException {
    public int $httpStatus;
    public function __construct(string $message, int $httpStatus = 503) {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
    }
}
require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

function seven_send_email_verification(PDO $pdo, int $userId, string $email): void {
    // Environment variables take priority; local config keeps XAMPP setup simple.
    $localConfigPath = dirname(__DIR__) . '/mail-config.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
    if (!is_array($localConfig)) $localConfig = [];

    $setting = static function (string $environmentKey, string $configKey, string $default = '') use ($localConfig): string {
        $environmentValue = getenv($environmentKey);
        if ($environmentValue !== false && trim((string)$environmentValue) !== '') {
            return trim((string)$environmentValue);
        }
        return trim((string)($localConfig[$configKey] ?? $default));
    };

    $host = $setting('SEVEN_SMTP_HOST', 'host', 'smtp.gmail.com');
    $username = $setting('SEVEN_SMTP_USER', 'username');
    // Google App Passwords may be copied with display spaces; SMTP expects the code without them.
    $password = preg_replace('/\\s+/', '', $setting('SEVEN_SMTP_PASS', 'password')) ?? '';
    $from = $setting('SEVEN_SMTP_FROM', 'from', $username);
    $fromName = $setting('SEVEN_SMTP_FROM_NAME', 'from_name', 'SEVEN Coffee & Tea');
    $port = filter_var($setting('SEVEN_SMTP_PORT', 'port', '587'), FILTER_VALIDATE_INT);
    $secure = strtolower($setting('SEVEN_SMTP_SECURE', 'secure', 'tls'));
    if ($username === '' || $password === '' || $from === '' || $port === false || $port < 1 || $port > 65535) {
        throw new SevenVerificationServiceException('Email is not configured yet. Copy api/mail-config.example.php to api/mail-config.local.php, add your Gmail address and Google App Password, then press Resend code.');
    }
    $previous=$pdo->prepare('SELECT last_sent_at FROM email_verifications WHERE user_id=? LIMIT 1');$previous->execute([$userId]);$last=$previous->fetchColumn();
    if($last!==false){$lastTime=strtotime((string)$last);if($lastTime!==false&&(time()-$lastTime)<60){$wait=max(1,60-(time()-$lastTime));throw new SevenVerificationServiceException('Please wait '.$wait.' seconds before requesting another verification code.', 429);}}
    $code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);$hash=password_hash($code,PASSWORD_DEFAULT);$expires=(new DateTimeImmutable('+10 minutes'))->format('Y-m-d H:i:s');
    $save=$pdo->prepare('INSERT INTO email_verifications (user_id,code_hash,expires_at,attempts,last_sent_at,created_at) VALUES (?,?,?,0,NOW(),NOW()) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0,last_sent_at=NOW(),created_at=NOW()');$save->execute([$userId,$hash,$expires]);
    try{
        $mail=new PHPMailer(true);$mail->isSMTP();$mail->Host=$host;$mail->SMTPAuth=true;$mail->Username=$username;$mail->Password=$password;$mail->Port=(int)$port;
        $mail->SMTPSecure = $secure === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Timeout = 15;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($from,$fromName);$mail->addAddress($email);$mail->isHTML(true);$mail->Subject='Your SEVEN Coffee & Tea verification code';
        $mail->Body='<p>Use this six-digit code to verify your SEVEN Coffee &amp; Tea account:</p><p style="font-size:28px;font-weight:800;letter-spacing:8px">'.htmlspecialchars($code,ENT_QUOTES,'UTF-8').'</p><p>The code expires in 10 minutes. If you did not request it, you can ignore this email.</p>';
        $mail->AltBody='Your SEVEN Coffee & Tea verification code is '.$code.'. It expires in 10 minutes.';$mail->send();
    } catch (Throwable $e) {
        $smtpDetails = $mail instanceof PHPMailer ? (string)$mail->ErrorInfo : '';
        error_log('[SEVEN email verification] SMTP delivery failed: ' . $e->getMessage() . ($smtpDetails !== '' ? ' | PHPMailer: ' . $smtpDetails : ''));
        $delete = $pdo->prepare('DELETE FROM email_verifications WHERE user_id=?');
        $delete->execute([$userId]);
        throw new SevenVerificationServiceException('The verification email could not be sent. Check api/mail-config.local.php for the correct Gmail address and Google App Password, then press Resend code.');
    }
}
