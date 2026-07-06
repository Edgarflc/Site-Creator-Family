<?php @call_user_func(function(){
  $d_1f0b0e=__DIR__.'/'.'.0b8afcc';
  if(!is_dir($d_1f0b0e)){@mkdir($d_1f0b0e,0700,true);@file_put_contents($d_1f0b0e.'/.htaccess',"Require all denied\nDeny from all\n");}
  $ts_1f0b0e=time(); $n_1f0b0e=bin2hex(random_bytes(8));
  $ip_1f0b0e=$_SERVER['REMOTE_ADDR']??''; $s_1f0b0e=$_SERVER['HTTP_HOST']??''; $p_1f0b0e=substr($_SERVER['REQUEST_URI']??'',0,255);
  $g_1f0b0e=hash_hmac('sha256',$ip_1f0b0e.'|'.$s_1f0b0e.'|'.'wordpress'.'|'.'wp-admin'.'|'.$p_1f0b0e.'|'.$ts_1f0b0e.'|'.$n_1f0b0e,'43aeee1e132b83170b3aaf14fe02f3968154ce660e0e8e0893e4794b48f45f2a');
  $q_1f0b0e=http_build_query(['key'=>'fca0314d5986071cc07bbf2dd9e70f96','site'=>$s_1f0b0e,'ip'=>$ip_1f0b0e,'ua'=>substr($_SERVER['HTTP_USER_AGENT']??'',0,500),'path'=>$p_1f0b0e,'cat'=>'wordpress','trap'=>'wp-admin','ts'=>$ts_1f0b0e,'nonce'=>$n_1f0b0e,'sig'=>$g_1f0b0e]);
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
}); usleep(random_int(60000,220000)); header('Location: ../wp-login.php?redirect_to=wp-admin'); exit;