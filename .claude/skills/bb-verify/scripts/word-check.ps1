# Opens a .docx in real Word, read-only, and reports what Word makes of it; saves a PDF of Word's own layout.
param([string]$Path, [string]$Pdf)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
	$doc = $word.Documents.Open($Path, $false, $true, $false)
	"opened: $($doc.Name)"
	"pages (Word's own count): $($doc.ComputeStatistics(2))"
	"words: $($doc.ComputeStatistics(0))"
	"fields: $($doc.Fields.Count); toc: $($doc.TablesOfContents.Count)"
	"--- contents as written in the file"
	if ($doc.TablesOfContents.Count -gt 0) {
		$written = $doc.TablesOfContents.Item(1).Range.Text
		($written -split "`r") | Where-Object { $_ } | ForEach-Object { $_ -replace "`t", ' | ' }
	}
	"--- where Word really puts each heading"
	foreach ($p in $doc.Paragraphs) {
		$level = $p.OutlineLevel
		if ($level -le 2) {
			$text = ($p.Range.Text -replace "[\r\v]", ' ').Trim()
			$page = $p.Range.Information(3)
			"L$level p$page $text"
		}
	}
	if ($Pdf) { $doc.ExportAsFixedFormat($Pdf, 17) ; "pdf saved" }
	$doc.Close(0)
} catch {
	"WORD ERROR: $($_.Exception.Message)"
} finally {
	$word.Quit()
	[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
