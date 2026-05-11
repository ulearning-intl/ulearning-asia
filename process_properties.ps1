$sourceDir = "d:\wenhuaEdu\翻译工具\ulearning-asia\locales"
$targetDir = "d:\wenhuaEdu\翻译工具\ulearning-asia\projects"

$files = Get-ChildItem -Path $sourceDir -Filter *.properties -Recurse
$totalFiles = $files.Count
$successFiles = 0
$skippedFiles = 0
$failedFiles = @()

foreach ($file in $files) {
    try {
        $relativePath = $file.FullName.Substring($sourceDir.Length).TrimStart('\', '/')
        $parts = $relativePath -split '[\\/]'
        
        if ($parts.Length -lt 2) {
            $skippedFiles++
            continue
        }
        
        $langName = $parts[0]
        $projectName = $file.BaseName
        $parentDirName = "locales"
        
        $targetProjectDir = Join-Path -Path $targetDir -ChildPath $projectName
        if (-not (Test-Path -Path $targetProjectDir)) {
            New-Item -ItemType Directory -Path $targetProjectDir -Force | Out-Null
        }
        
        $targetFilename = "${parentDirName}_${langName}_${projectName}.properties"
        $targetFilePath = Join-Path -Path $targetProjectDir -ChildPath $targetFilename
        
        Copy-Item -Path $file.FullName -Destination $targetFilePath -Force
        $successFiles++
    }
    catch {
        $failedFiles += [PSCustomObject]@{
            Path = $file.FullName
            Error = $_.Exception.Message
        }
    }
}

Write-Output "扫描到的 .properties 文件总数: $totalFiles"
Write-Output "成功整理的文件数量: $successFiles"
Write-Output "跳过的文件数量: $skippedFiles"
Write-Output "处理失败的文件数量: $($failedFiles.Count)"
if ($failedFiles.Count -gt 0) {
    Write-Output "处理失败的文件列表和错误原因:"
    $failedFiles | Format-Table -AutoSize
}
