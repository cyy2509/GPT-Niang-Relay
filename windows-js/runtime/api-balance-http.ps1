# Use Windows system proxy settings. Credentials arrive on stdin, never argv.
$ErrorActionPreference='Stop'
$request=$null;$response=$null;$stream=$null;$memory=$null
try{
  $inputData=[Console]::In.ReadToEnd() | ConvertFrom-Json
  if(![string]$inputData.token -or [string]$inputData.token-match "[\r\n]"){throw 'Invalid input'}
  $uri=[Uri]$inputData.url
  if(!$uri.IsAbsoluteUri -or $uri.Scheme-ne 'https' -or $uri.UserInfo){throw 'Invalid endpoint'}
  $request=[Net.HttpWebRequest]::Create($uri)
  $request.Method='GET'
  $request.AllowAutoRedirect=$false
  $request.Proxy=[Net.WebRequest]::GetSystemWebProxy()
  $request.Timeout=[Math]::Min(18000,[Math]::Max(1000,[int]$inputData.timeoutMs))
  $request.ReadWriteTimeout=$request.Timeout
  $request.Accept='application/json'
  $request.AutomaticDecompression=[Net.DecompressionMethods]::GZip -bor [Net.DecompressionMethods]::Deflate
  $request.Headers['Authorization']='Bearer '+[string]$inputData.token
  try{$response=$request.GetResponse()}catch [Net.WebException]{if($_.Exception.Response){$response=$_.Exception.Response}else{throw}}
  $stream=$response.GetResponseStream()
  $memory=New-Object IO.MemoryStream
  $buffer=New-Object byte[] 8192
  while(($count=$stream.Read($buffer,0,$buffer.Length))-gt 0){
    if($memory.Length+$count-gt 1048576){throw 'Response exceeds limit'}
    $memory.Write($buffer,0,$count)
  }
  $result=@{status=[int]$response.StatusCode;body=[Text.Encoding]::UTF8.GetString($memory.ToArray());networkError=$false}
  [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
  [Console]::WriteLine(($result | ConvertTo-Json -Compress))
}catch{
  [Console]::WriteLine('{"networkError":true}')
}finally{
  if($stream){$stream.Dispose()}
  if($memory){$memory.Dispose()}
  if($response){$response.Close()}
}
