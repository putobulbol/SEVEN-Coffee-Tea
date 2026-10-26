<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require_once __DIR__ . '/lib/email_verification_service.php';
try {
    $pending=(int)($_SESSION['pending_email_verification_user_id']??0);
    if($pending<=0)respond(['ok'=>false,'message'=>'No pending email verification was found. Start registration or sign in again.'],401);
    $pdo=db();$stmt=$pdo->prepare("SELECT id,email,email_verified_at FROM users WHERE id=? AND role='customer' LIMIT 1");$stmt->execute([$pending]);$user=$stmt->fetch();
    if(!$user){unset($_SESSION['pending_email_verification_user_id']);respond(['ok'=>false,'message'=>'The pending account was not found. Please register again.'],404);}
    if(!empty($user['email_verified_at'])){unset($_SESSION['pending_email_verification_user_id']);respond(['ok'=>true,'verified'=>true,'email'=>$user['email'],'message'=>'Your email is already verified. You can log in.']);}
    if($_SERVER['REQUEST_METHOD']==='GET')respond(['ok'=>true,'email'=>(string)$user['email']]);
    if($_SERVER['REQUEST_METHOD']!=='POST')respond(['ok'=>false,'message'=>'Unsupported method.'],405);
    $input=json_input();$action=(string)($input['action']??'verify');
    if($action==='resend'){seven_send_email_verification($pdo,$pending,(string)$user['email']);respond(['ok'=>true,'message'=>'A new verification code was sent. It expires in 10 minutes.']);}
    if($action!=='verify')respond(['ok'=>false,'message'=>'Invalid email verification action.'],422);
    $code=trim((string)($input['code']??''));if(!preg_match('/^[0-9]{6}$/',$code))respond(['ok'=>false,'message'=>'Enter the six-digit code from your email.'],422);
    $q=$pdo->prepare('SELECT code_hash,expires_at,attempts FROM email_verifications WHERE user_id=? LIMIT 1');$q->execute([$pending]);$row=$q->fetch();
    if(!$row)respond(['ok'=>false,'message'=>'No active code was found. Request a new code.'],410);
    if((int)$row['attempts']>=5)respond(['ok'=>false,'message'=>'You used all five attempts. Wait for the resend cooldown, then request a new code.'],429);
    $expires=strtotime((string)$row['expires_at']);if($expires===false||$expires<time())respond(['ok'=>false,'message'=>'That code has expired. Request a new code.'],410);
    if(!password_verify($code,(string)$row['code_hash'])){$u=$pdo->prepare('UPDATE email_verifications SET attempts=attempts+1 WHERE user_id=?');$u->execute([$pending]);$n=(int)$row['attempts']+1;respond(['ok'=>false,'message'=>$n>=5?'Incorrect code. You used all five attempts; request a new code after the cooldown.':'That code is incorrect. You have '.(5-$n).' attempt(s) left.'],422);}
    $verify=$pdo->prepare("UPDATE users SET email_verified_at=NOW() WHERE id=? AND role='customer' AND email_verified_at IS NULL");$verify->execute([$pending]);$delete=$pdo->prepare('DELETE FROM email_verifications WHERE user_id=?');$delete->execute([$pending]);unset($_SESSION['pending_email_verification_user_id']);
    respond(['ok'=>true,'verified'=>true,'message'=>'Email verified successfully. You can now log in.']);
}catch(SevenVerificationServiceException $e){respond(['ok'=>false,'message'=>$e->getMessage()],$e->httpStatus);}catch(Throwable $e){respond(['ok'=>false,'message'=>'Email verification is temporarily unavailable. Please try again.'],500);}
