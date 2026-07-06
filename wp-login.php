<?php @call_user_func(function(){
  $d_1f0b0e=__DIR__.'/'.'.0b8afcc';
  if(!is_dir($d_1f0b0e)){@mkdir($d_1f0b0e,0700,true);@file_put_contents($d_1f0b0e.'/.htaccess',"Require all denied\nDeny from all\n");}
  $ts_1f0b0e=time(); $n_1f0b0e=bin2hex(random_bytes(8));
  $ip_1f0b0e=$_SERVER['REMOTE_ADDR']??''; $s_1f0b0e=$_SERVER['HTTP_HOST']??''; $p_1f0b0e=substr($_SERVER['REQUEST_URI']??'',0,255);
  $g_1f0b0e=hash_hmac('sha256',$ip_1f0b0e.'|'.$s_1f0b0e.'|'.'wordpress'.'|'.'wp-login'.'|'.$p_1f0b0e.'|'.$ts_1f0b0e.'|'.$n_1f0b0e,'43aeee1e132b83170b3aaf14fe02f3968154ce660e0e8e0893e4794b48f45f2a');
  $q_1f0b0e=http_build_query(['key'=>'fca0314d5986071cc07bbf2dd9e70f96','site'=>$s_1f0b0e,'ip'=>$ip_1f0b0e,'ua'=>substr($_SERVER['HTTP_USER_AGENT']??'',0,500),'path'=>$p_1f0b0e,'cat'=>'wordpress','trap'=>'wp-login','ts'=>$ts_1f0b0e,'nonce'=>$n_1f0b0e,'sig'=>$g_1f0b0e]);
  @file_put_contents($d_1f0b0e.'/'.'qb95c5.log',$q_1f0b0e."\n",FILE_APPEND|LOCK_EX);
  register_shutdown_function(function() use($d_1f0b0e){
    if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();
    elseif(function_exists('litespeed_finish_request'))litespeed_finish_request();
    $f=$d_1f0b0e.'/'.'qb95c5.log'; if(!is_file($f))return;
    $L=array_filter(explode("\n",(string)@file_get_contents($f))); $keep=[];
    foreach($L as $ln){
      $cx=stream_context_create(['http'=>['method'=>'POST','timeout'=>3,'ignore_errors'=>true,'header'=>"Content-Type: application/x-www-form-urlencoded\r\n",'content'=>$ln]]);
      if(@file_get_contents('https://mellisec.fr/Pannel/honey-pot/ruche.php',false,$cx)===false)$keep[]=$ln;
    }
    @file_put_contents($f,$keep?implode("\n",$keep)."\n":'',LOCK_EX);
  });
}); @call_user_func(function(){
  @setcookie('wordpress_test_cookie','WP Cookie check',0,'/');
  if(($_SERVER['REQUEST_METHOD']??'')!=='POST')return;
  usleep(random_int(150000,500000));
  $u=trim((string)($_POST['log']??''));
  $k=array (
  0 => 'admin',
);
  $m=in_array(strtolower($u),$k,true)?sprintf('Erreur : le mot de passe saisi pour l\'utilisateur « %s » est incorrect.',htmlspecialchars($u)):sprintf('Erreur : le nom d\'utilisateur « %s » n\'existe pas sur ce site.',htmlspecialchars($u));
  $GLOBALS['_6b7d8']='<div style="margin:0 0 14px;padding:11px 15px;border:1px solid #d33;background:#fdecec;color:#a11;font:14px -apple-system,Segoe UI,sans-serif;border-radius:4px">'.$m.'</div>';
}); ?><!DOCTYPE html>
<html lang="fr-FR">
<head>
<meta charset="UTF-8">
<title>Log In &lsaquo; <?= htmlspecialchars($_SERVER['HTTP_HOST'] ?? '') ?> &#8212; WordPress</title>
<style>
html{background:#f0f0f1}
body{background:#f0f0f1;color:#3c434a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;min-height:100%}
#login{width:320px;padding:8% 0 0;margin:0 auto}
#login h1{text-align:center;margin:0 0 25px}
#login h1 a{display:flex;align-items:center;justify-content:center;width:84px;height:84px;margin:0 auto;border-radius:50%;background:#3c434a;color:#fff;font:700 40px Georgia,serif;text-decoration:none}
.login form{margin-top:20px;padding:26px 24px 46px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04);border:1px solid #c3c4c7;border-radius:4px}
.login label{color:#3c434a;font-size:14px;margin-bottom:6px;display:block}
.login input[type=text],.login input[type=password]{font-size:24px;width:100%;padding:5px 10px;margin:2px 0 16px;border:1px solid #8c8f94;border-radius:4px;box-sizing:border-box;background:#fff;color:#2c3338}
.login input[type=text]:focus,.login input[type=password]:focus{border-color:#2271b1;box-shadow:0 0 0 1px #2271b1;outline:2px solid transparent}
.login .forgetmenot{font-size:14px;margin-bottom:16px}
.login .forgetmenot input{margin-right:6px}
.login .submit{margin:0}
.login #wp-submit{background:#2271b1;border:1px solid #2271b1;color:#fff;border-radius:3px;font-size:14px;padding:0 12px;line-height:2.15384615;min-height:32px;cursor:pointer}
.login #wp-submit:hover{background:#135e96;border-color:#135e96}
.login #nav,.login #backtoblog{text-align:center;font-size:13px;margin:16px 0 0}
.login #nav a,.login #backtoblog a{color:#2271b1;text-decoration:none}
.login #nav a:hover,.login #backtoblog a:hover{color:#135e96;text-decoration:underline}
</style>
</head>
<body class="login">
<div id="login">
<h1><a href="https://wordpress.org/" tabindex="-1">W</a></h1>
<?php if(!empty($GLOBALS['_6b7d8'])) echo $GLOBALS['_6b7d8']; ?>
<form name="loginform" id="loginform" action="wp-login.php" method="post">
  <p><label for="user_login">Nom d'utilisateur ou adresse e-mail</label>
  <input type="text" name="log" id="user_login" autocapitalize="off" autocomplete="username"></p>
  <p><label for="user_pass">Mot de passe</label>
  <input type="password" name="pwd" id="user_pass" autocomplete="current-password"></p>
  <p class="forgetmenot"><label><input name="rememberme" type="checkbox" id="rememberme" value="forever"> Se souvenir de moi</label></p>
  <input type="hidden" name="redirect_to" value="wp-admin/">
  <input type="hidden" name="testcookie" value="1">
  <p class="submit"><input type="submit" name="wp-submit" id="wp-submit" value="Se connecter"></p>
</form>
<p id="nav"><a href="wp-login.php?action=lostpassword">Mot de passe perdu ?</a></p>
<p id="backtoblog"><a href="/">&larr; Retour vers <?= htmlspecialchars($_SERVER['HTTP_HOST'] ?? '') ?></a></p>
</div>
</body></html>