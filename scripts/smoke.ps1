param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
Write-Host "Running smoke check against: $BaseUrl"

Write-Host "1. Health check:"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
Write-Host ($health | ConvertTo-Json -Compress)

Write-Host "`n2. Create sample class:"
$classResp = Invoke-RestMethod -Uri "$BaseUrl/api/classes/sample" -Method Post
Write-Host ($classResp | ConvertTo-Json -Compress)
$code = $classResp.join_code
Write-Host "Got join code: $code"

Write-Host "`n3. Join class as student:"
$joinBody = @{
    join_code = $code
    nickname = "smoke"
} | ConvertTo-Json
$joinResp = Invoke-RestMethod -Uri "$BaseUrl/api/join" -Method Post -ContentType "application/json" -Body $joinBody
Write-Host ($joinResp | ConvertTo-Json -Compress)
$token = $joinResp.student_token
$qid = $joinResp.quiz.questions[0].question_id

Write-Host "`n4. Submit answer to question ${qid}:"
$respBody = @{
    question_id = $qid
    answer = "3/4"
    explanation = "1/2 is 2/4 so 2/4 + 1/4 = 3/4"
    self_confidence = "sure"
} | ConvertTo-Json
$submitResp = Invoke-RestMethod -Uri "$BaseUrl/api/responses" -Method Post -ContentType "application/json" -Headers @{"X-Student-Token" = $token} -Body $respBody
Write-Host ($submitResp | ConvertTo-Json -Compress)

Write-Host "`nSmoke check PASSED successfully!" -ForegroundColor Green
