import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Send
} from "lucide-react";
import { receiveEmailData } from "@/api/functions";

export default function N8nImport({ onEmailsProcessed }) {
  const [jsonData, setJsonData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError('');
    setResults(null);

    try {
      // Valideer JSON format
      let parsedData;
      try {
        parsedData = JSON.parse(jsonData);
      } catch (parseError) {
        setError('Ongeldige JSON format. Controleer uw data.');
        setIsProcessing(false);
        return;
      }

      // Verstuur naar de backend functie
      const { data } = await receiveEmailData(parsedData);
      
      setResults(data);
      
      if (onEmailsProcessed) {
        onEmailsProcessed();
      }

    } catch (submitError) {
      setError(submitError.message || 'Fout bij verwerken van e-mail data');
    }

    setIsProcessing(false);
  };

  const exampleJson = `{
  "defaultMailAccountName": "n8n Import",
  "emails": [
    {
      "subject": "Thank you for contacting us",
      "from": "support@company.com",
      "body": "Thank you for your inquiry. We're tracking your request in case #12345.",
      "date": "2024-12-19T10:30:00Z"
    },
    {
      "subject": "Another email",
      "from": "customer@example.com", 
      "body": "Email content here...",
      "date": "2024-12-19T11:00:00Z"
    }
  ]
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          n8n E-mail Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">JSON E-mail Data</label>
          <Textarea
            placeholder="Plak hier uw JSON e-mail data..."
            value={jsonData}
            onChange={(e) => setJsonData(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 hover:text-slate-800">
            Bekijk voorbeeld JSON formaat
          </summary>
          <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-x-auto">
            <code>{exampleJson}</code>
          </pre>
        </details>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <Alert className={results.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Resultaat:</strong> {results.message}</p>
                
                {results.summary && (
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-blue-100 text-blue-800">
                      Totaal: {results.summary.total}
                    </Badge>
                    <Badge className="bg-green-100 text-green-800">
                      Succesvol: {results.summary.processed}
                    </Badge>
                    <Badge className="bg-red-100 text-red-800">
                      Mislukt: {results.summary.failed}
                    </Badge>
                  </div>
                )}

                {results.results && results.results.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">Bekijk details</summary>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {results.results.map((result, index) => (
                        <div key={index} className="text-xs flex items-center gap-2">
                          {result.success ? 
                            <CheckCircle2 className="w-3 h-3 text-green-500" /> : 
                            <XCircle className="w-3 h-3 text-red-500" />
                          }
                          <span className="truncate">{result.email.subject}</span>
                          {result.caseNumber && (
                            <Badge variant="outline" className="text-xs">#{result.caseNumber}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isProcessing || !jsonData.trim()}
          className="w-full gap-2"
        >
          {isProcessing ? (
            <>
              <FileText className="w-4 h-4 animate-pulse" />
              Verwerken...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Verwerk E-mail Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}