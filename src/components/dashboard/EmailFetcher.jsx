
/* eslint-disable react/prop-types */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Select component is no longer needed
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  RefreshCw, 
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchEmails, fetchEmailMessage, fetchEmailMessages, getStoredEmails, markProcessed } from "@/api/functions";
import { processEmail } from "@/api/functions";
// MailAccount entity is no longer directly used in this component
// import { MailAccount } from "@/api/entities";

export default function EmailFetcher({ onEmailProcessed }) {
  const [emails, setEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processing, setProcessing] = useState({});
  const [loadingBody, setLoadingBody] = useState({});
  const [error, setError] = useState('');
  const [fetchInfo, setFetchInfo] = useState(null);

  // Helper: sequential fetch with small delays to avoid IMAP disconnects
  const fetchSequentially = async (emailsList) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    for (const e of emailsList) {
      if (!e.body && e.id) {
        setLoadingBody(prev => ({ ...prev, [e.id]: true }));

        let attempt = 0;
        let fetched = false;
        while (attempt < 2 && !fetched) {
          attempt += 1;
          try {
                const res = await fetchEmailMessage({ emailId: e.id });
            if (res?.data?.success && res.data.body) {
              setEmails(prev => prev.map(pe => pe.id === e.id ? { ...pe, body: res.data.body } : pe));
              fetched = true;
              break;
            }
          } catch (err) {
                console.warn('fetchEmailMessage failed', err);
                setEmails(prev => prev.map(pe => pe.id === e.id ? { ...pe, error: pe.error || (err.message || 'Fout bij ophalen inhoud') } : pe));
          }

          await sleep(300);
        }

        setLoadingBody(prev => ({ ...prev, [e.id]: false }));
        await sleep(200);
      }
    }
  };
  // Removed mailAccounts and selectedAccountId states as per new requirements
  // const [mailAccounts, setMailAccounts] = useState([]);
  // const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Removed useEffect for loading mail accounts as per new requirements
  // useEffect(() => {
  //   async function loadMailAccounts() {
  //     try {
  //       const accounts = await MailAccount.filter({ enabled: true });
  //       setMailAccounts(accounts);
  //       if (accounts.length > 0) {
  //         setSelectedAccountId(accounts[0].id);
  //       }
  //     } catch (err) { // Corrected from `(err) =>` to `(err)`
  //       setError('Kon mailaccounts niet laden.');
  //     }
  //   }
  //   loadMailAccounts();
  // }, []);

  const fetchLatestEmails = async () => {
    // No need to check for selectedAccountId
    // if (!selectedAccountId) {
    //   setError("Selecteer eerst een mailaccount.");
    //   return;
    // }
    setIsLoading(true);
    setError('');
    setEmails([]);
    
    try {
  // Ask the backend to include the full message bodies if it supports this.
  // This avoids multiple per-email IMAP requests which can cause the IMAP
  // connection to be lost on some servers. If the backend doesn't include
  // bodies, we fall back to a safer sequential per-email fetch with retries.
  const { data } = await fetchEmails({ includeBody: true });
      
      if (data.success) {
        setEmails(data.emails);

        // If backend returned bodies we're done. If not, try a safer sequential
        // fallback per-email fetch with retries/delays to avoid IMAP disconnects.
        const anyMissingBody = data.emails.some(e => !e.body && e.id);
        if (anyMissingBody) {
          // Try a single bulk request first to reduce IMAP roundtrips.
          const missingIds = data.emails.filter(e => !e.body && e.id).map(e => e.id);

          try {
            const bulkRes = await fetchEmailMessages({ emailIds: missingIds });
            if (bulkRes?.data?.success && Array.isArray(bulkRes.data.messages)) {
              // bulkRes.data.messages expected shape: [{ id, body }, ...]
              const bodyMap = new Map(bulkRes.data.messages.map(m => [m.id, m.body]));
              setEmails(prev => prev.map(pe => bodyMap.has(pe.id) ? { ...pe, body: bodyMap.get(pe.id) } : pe));
            } else {
              // fallback to safer sequential fetch
              await fetchSequentially(data.emails);
            }
          } catch (err) {
            // bulk call failed or unsupported — fallback to sequential fetch
            console.warn('fetchEmailMessages failed, falling back to sequential fetch', err);
            await fetchSequentially(data.emails);
          }
        }
        setFetchInfo({
          total: data.total,
          server: data.server,
          folder: data.folder,
          // accountName: data.accountName, // Removed
        });
      } else {
        setError(data.error || 'Onbekende fout bij ophalen e-mails');
      }
    } catch (err) {
      setError(err.message || 'Fout bij ophalen e-mails');
    }
    
    setIsLoading(false);
  };

  const processEmailHandler = async (email) => {
    // Removed selectedAccount lookup
    // const selectedAccount = mailAccounts.find(acc => acc.id === selectedAccountId);
    // if (!selectedAccount) return;

    setProcessing(prev => ({ ...prev, [email.id]: true }));
    
    try {
      const { data } = await processEmail({ 
        email,
        mailAccountId: 'settings', // Hardcoded as per outline
        mailAccountName: 'IMAP Instellingen' // Hardcoded as per outline
      });
      
        if (data.success) {
        setEmails(prev => prev.map(e => 
          e.id === email.id 
            ? { ...e, processed: true, processingResult: data }
            : e
        ));
        
        // Persist processed state to local server (if available)
        try {
          await markProcessed({ id: email.id, message: data.message, intercomId: data.intercomConversationId, processingTime: data.processingTime });
        } catch (err) {
          console.warn('markProcessed failed', err);
        }

        if (onEmailProcessed) {
          onEmailProcessed();
        }
      } else {
        setEmails(prev => prev.map(e => 
          e.id === email.id 
            ? { ...e, processed: false, error: data.message }
            : e
        ));
      }
    } catch (err) {
      setEmails(prev => prev.map(e => 
        e.id === email.id 
          ? { ...e, processed: false, error: err.message }
          : e
      ));
    }
    
    setProcessing(prev => ({ ...prev, [email.id]: false }));
  };

  const extractCaseNumber = (subject) => {
    const match = subject.match(/Your case # ([A-Z0-9]+)/i);
    return match ? match[1] : null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Handmatige E-mail Controle
          </CardTitle>

          {/* Removed the Select component for mail accounts */}
          {/* <div className="flex w-full md:w-auto items-center gap-3">
            <Select 
              value={selectedAccountId || ''} 
              onValueChange={setSelectedAccountId}
              disabled={mailAccounts.length === 0}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecteer een mailaccount" />
              </SelectTrigger>
              <SelectContent>
                {mailAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.imap_username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={fetchLatestEmails} 
              disabled={isLoading || !selectedAccountId}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Zoeken...' : 'Zoek laatste 5'}
            </Button>
          </div> */}

          {/* Updated Button to be standalone and only disabled by isLoading */}
          <Button 
            onClick={fetchLatestEmails} 
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Zoeken...' : 'Zoek laatste 5'}
          </Button>
          <Button
            onClick={async () => {
              setIsLoading(true);
              const { data } = await getStoredEmails();
              if (data?.success) setEmails(data.emails || []);
              setIsLoading(false);
            }}
            className="gap-2"
          >
            Load opgeslagen
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fetchInfo && (
          <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {/* Removed accountName display */}
              {/* <span><strong>Account:</strong> {fetchInfo.accountName}</span> */}
              <span><strong>Server:</strong> {fetchInfo.server}</span>
              <span><strong>Map:</strong> {fetchInfo.folder}</span>
              <span><strong>Totaal in map:</strong> {fetchInfo.total} e-mails</span>
            </div>
          </div>
        )}

        {emails.length > 0 && (
          <div className="space-y-3">
            {emails.map((email) => {
              const caseNumber = extractCaseNumber(email.subject);
              const isProcessing = processing[email.id];
              
              return (
                <div key={email.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {caseNumber && (
                          <Badge variant="outline" className="text-xs">
                            #{caseNumber}
                          </Badge>
                        )}
                        
                        {email.isRead && (
                          <Badge variant="outline" className="text-xs text-slate-500">
                            Gelezen
                          </Badge>
                        )}
                        
                        {email.processed === true && (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verwerkt
                          </Badge>
                        )}
                        
                        {email.processed === false && (
                          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Fout
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-medium text-slate-900 mb-1 line-clamp-1">
                        {email.subject}
                      </h4>
                      
                      <p className="text-sm text-slate-500 mb-1">
                        Van: {email.from}
                      </p>
                      
                      <p className="text-xs text-slate-400">
                        {format(new Date(email.date), 'dd MMM yyyy HH:mm', { locale: nl })}
                      </p>
                      
                      {email.error && (
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                          {email.error}
                        </p>
                      )}
                      
                      {email.processingResult && (
                        <div className="text-xs text-green-600 bg-green-50 p-2 rounded mt-2">
                          <p>✅ {email.processingResult.message}</p>
                          <p>Intercom ID: {email.processingResult.intercomConversationId}</p>
                          <p>Verwerkingstijd: {email.processingResult.processingTime}ms</p>
                        </div>
                      )}
                      {loadingBody[email.id] && (
                        <p className="text-xs text-slate-500 mt-2">Inhoud wordt geladen…</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {email.processed !== true && (
                        <Button
                          size="sm"
                          onClick={() => processEmailHandler(email)}
                          disabled={isProcessing || !caseNumber}
                          className="gap-1 text-xs"
                        >
                          {isProcessing ? (
                            <>
                              <Clock className="w-3 h-3 animate-spin" />
                              Verwerken...
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              Verwerken
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* E-mail preview */}
                  <details className="mt-3">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                      Bekijk inhoud
                    </summary>
                    <div className="mt-2 p-3 bg-slate-50 rounded text-xs max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{email.body || (loadingBody[email.id] ? 'Laden...' : 'Geen inhoud beschikbaar')}</pre>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        {/* Updated empty state message */}
        {emails.length === 0 && !isLoading && !error && ( // Removed mailAccounts.length check
          <div className="text-center py-8 text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Klik op &quot;Zoek laatste 5&quot; voor een handmatige controle van het geconfigureerde mailaccount.</p>
            <p className="text-xs mt-1">Automatische verwerking gebeurt op de achtergrond met de ingestelde filters.</p>
          </div>
        )}
        
        {/* Removed the "add mail account" message as it's no longer relevant for this component */}
        {/* {mailAccounts.length === 0 && (
           <div className="text-center py-8 text-slate-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Voeg eerst een mailaccount toe op de 'Mail Accounts' pagina.</p>
          </div>
        )} */}
      </CardContent>
    </Card>
  );
}
