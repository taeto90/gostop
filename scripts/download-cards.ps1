# Hwatu 카드 SVG 일괄 다운로드 (Wikimedia Commons / CC BY-SA 4.0)
# 출처: https://commons.wikimedia.org/wiki/Category:SVG_Hwatu

$BASE = "https://commons.wikimedia.org/wiki/Special:FilePath"
$DEST = "C:\Users\skyst\GoStop\apps\web\public\assets\cards"
$UA = "GoStopFriendsGame/1.0 (https://github.com/personal-project; educational, friend-use)"

New-Item -ItemType Directory -Force -Path $DEST | Out-Null

$cards = @(
  @{file="January_Hikari"; out="m01-gwang.svg"},
  @{file="January_Tanzaku"; out="m01-ddi.svg"},
  @{file="January_Kasu_1"; out="m01-pi-1.svg"},
  @{file="January_Kasu_2"; out="m01-pi-2.svg"},
  @{file="February_Tane"; out="m02-yeol.svg"},
  @{file="February_Tanzaku"; out="m02-ddi.svg"},
  @{file="February_Kasu_1"; out="m02-pi-1.svg"},
  @{file="February_Kasu_2"; out="m02-pi-2.svg"},
  @{file="March_Hikari"; out="m03-gwang.svg"},
  @{file="March_Tanzaku"; out="m03-ddi.svg"},
  @{file="March_Kasu_1"; out="m03-pi-1.svg"},
  @{file="March_Kasu_2"; out="m03-pi-2.svg"},
  @{file="April_Tane"; out="m04-yeol.svg"},
  @{file="April_Tanzaku"; out="m04-ddi.svg"},
  @{file="April_Kasu_1"; out="m04-pi-1.svg"},
  @{file="April_Kasu_2"; out="m04-pi-2.svg"},
  @{file="May_Tane"; out="m05-yeol.svg"},
  @{file="May_Tanzaku"; out="m05-ddi.svg"},
  @{file="May_Kasu_1"; out="m05-pi-1.svg"},
  @{file="May_Kasu_2"; out="m05-pi-2.svg"},
  @{file="June_Tane"; out="m06-yeol.svg"},
  @{file="June_Tanzaku"; out="m06-ddi.svg"},
  @{file="June_Kasu_1"; out="m06-pi-1.svg"},
  @{file="June_Kasu_2"; out="m06-pi-2.svg"},
  @{file="July_Tane"; out="m07-yeol.svg"},
  @{file="July_Tanzaku"; out="m07-ddi.svg"},
  @{file="July_Kasu_1"; out="m07-pi-1.svg"},
  @{file="July_Kasu_2"; out="m07-pi-2.svg"},
  @{file="August_Hikari"; out="m08-gwang.svg"},
  @{file="August_Tane"; out="m08-yeol.svg"},
  @{file="August_Kasu_1"; out="m08-pi-1.svg"},
  @{file="August_Kasu_2"; out="m08-pi-2.svg"},
  @{file="September_Tane"; out="m09-yeol.svg"},
  @{file="September_Tanzaku"; out="m09-ddi.svg"},
  @{file="September_Kasu_1"; out="m09-ssangpi.svg"},
  @{file="September_Kasu_2"; out="m09-pi.svg"},
  @{file="October_Tane"; out="m10-yeol.svg"},
  @{file="October_Tanzaku"; out="m10-ddi.svg"},
  @{file="October_Kasu_1"; out="m10-pi-1.svg"},
  @{file="October_Kasu_2"; out="m10-pi-2.svg"},
  @{file="November_Hikari"; out="m11-gwang.svg"},
  @{file="November_Kasu_1"; out="m11-pi-1.svg"},
  @{file="November_Kasu_2"; out="m11-pi-2.svg"},
  @{file="November_Kasu_3"; out="m11-ssangpi.svg"},
  @{file="December_Hikari"; out="m12-gwang.svg"},
  @{file="December_Tane"; out="m12-yeol.svg"},
  @{file="December_Tanzaku"; out="m12-ddi.svg"},
  @{file="December_Kasu"; out="m12-ssangpi.svg"}
)

$total = $cards.Count
$ok = 0
$skip = 0
$fail = @()

foreach ($card in $cards) {
  $output = Join-Path $DEST $card.out

  # 이미 받은 건 스킵
  if (Test-Path $output) {
    $size = (Get-Item $output).Length
    if ($size -gt 1000) {
      Write-Host "SKIP $($card.out) (already exists, $size bytes)" -ForegroundColor DarkGray
      $skip++
      continue
    }
  }

  $url = "$BASE/Hwatu_$($card.file).svg"
  $maxRetries = 3
  $retry = 0
  $success = $false

  while ($retry -lt $maxRetries -and -not $success) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $output -UserAgent $UA -ErrorAction Stop -MaximumRedirection 10
      $size = (Get-Item $output).Length
      Write-Host "OK   $($card.out) ($size bytes)" -ForegroundColor Green
      $ok++
      $success = $true
    } catch {
      $retry++
      if ($retry -lt $maxRetries) {
        Write-Host "RETRY $($card.out) (attempt $retry of $maxRetries) ..." -ForegroundColor Yellow
        Start-Sleep -Seconds (5 * $retry)
      } else {
        Write-Host "FAIL $($card.out): $($_.Exception.Message)" -ForegroundColor Red
        $fail += $card.out
      }
    }
  }

  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Result: $ok new, $skip skipped, $($fail.Count) failed (total $total)" -ForegroundColor Cyan
if ($fail.Count -gt 0) {
  Write-Host "Failed: $($fail -join ', ')" -ForegroundColor Yellow
}
