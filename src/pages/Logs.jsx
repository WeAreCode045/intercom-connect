
import React, { useState, useEffect, useCallback } from "react";
import { EmailLog } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ScrollText, 
  Search, 
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await EmailLog.list('-created_date', 200);
      setLogs(data);
    } catch (error) {
      console.error('Fout bij laden logs:', error);
    }
    setIsLoading(false);
  };

  const filterLogs = useCallback(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.email_subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.sender?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.case_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, statusFilter]);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [filterLogs]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'case_not_found': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed': return <CheckCircle2 className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'case_not_found': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const exportLogs = () => {
    const csvContent = [
      'Datum,Onderwerp,Afzender,Case Nummer,Status,Intercom ID,Verwerkingstijd,Foutmelding',
      ...filteredLogs.map(log => [
        format(new Date(log.created_date), 'yyyy-MM-dd HH:mm:ss'),
        log.email_subject?.replace(/"/g, '""') || '',
        log.sender?.replace(/"/g, '""') || '',
        log.case_number || '',
        log.status || '',
        log.intercom_conversation_id || '',
        log.processing_time || '',
        log.error_message?.replace(/"/g, '""') || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `mailsync-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-8 h-8" />
            E-mail Logs
          </h1>
          <p className="text-slate-600 mt-1">Overzicht van alle verwerkte e-mails</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportLogs} className="gap-2">
            <Download className="w-4 h-4" />
            Exporteren
          </Button>
          <Button onClick={loadLogs} disabled={isLoading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Zoek op onderwerp, afzender of case nummer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="processed">Verwerkt</SelectItem>
                <SelectItem value="failed">Mislukt</SelectItem>
                <SelectItem value="pending">In behandeling</SelectItem>
                <SelectItem value="case_not_found">Case niet gevonden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
            <span>Totaal: {filteredLogs.length} logs</span>
            <span>•</span>
            <span>Verwerkt: {filteredLogs.filter(l => l.status === 'processed').length}</span>
            <span>•</span>
            <span>Mislukt: {filteredLogs.filter(l => l.status === 'failed').length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activiteiten Overzicht</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${getStatusColor(log.status)} border flex items-center gap-1 text-xs`}>
                          {getStatusIcon(log.status)}
                          {log.status}
                        </Badge>
                        
                        {log.case_number && (
                          <Badge variant="outline" className="text-xs">
                            #{log.case_number}
                          </Badge>
                        )}
                        
                        {log.processing_time && (
                          <Badge variant="outline" className="text-xs text-slate-500">
                            {log.processing_time}ms
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="font-medium text-slate-900 mb-1 line-clamp-1">
                        {log.email_subject}
                      </h3>
                      
                      <p className="text-sm text-slate-500 mb-1">
                        Van: {log.sender}
                      </p>
                      
                      {log.error_message && (
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                          {log.error_message}
                        </p>
                      )}
                      
                      {log.intercom_conversation_id && (
                        <p className="text-xs text-green-600">
                          Intercom ID: {log.intercom_conversation_id}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-slate-500">
                        <p>{format(new Date(log.created_date), 'dd MMM yyyy', { locale: nl })}</p>
                        <p>{format(new Date(log.created_date), 'HH:mm:ss', { locale: nl })}</p>
                      </div>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Log Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong>Status:</strong>
                                <Badge className={`${getStatusColor(log.status)} border ml-2`}>
                                  {log.status}
                                </Badge>
                              </div>
                              <div>
                                <strong>Datum:</strong> {format(new Date(log.created_date), 'dd MMM yyyy HH:mm:ss', { locale: nl })}
                              </div>
                              <div>
                                <strong>Afzender:</strong> {log.sender}
                              </div>
                              <div>
                                <strong>Case Nummer:</strong> {log.case_number || 'Niet gevonden'}
                              </div>
                            </div>
                            
                            <div>
                              <strong>Onderwerp:</strong>
                              <p className="mt-1 p-2 bg-slate-100 rounded text-sm">{log.email_subject}</p>
                            </div>
                            
                            {log.email_content && (
                              <div>
                                <strong>E-mail Inhoud:</strong>
                                <div className="mt-1 p-3 bg-slate-50 rounded text-sm max-h-48 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap">{log.email_content}</pre>
                                </div>
                              </div>
                            )}
                            
                            {log.error_message && (
                              <div>
                                <strong>Foutmelding:</strong>
                                <p className="mt-1 p-2 bg-red-50 text-red-800 rounded text-sm">{log.error_message}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredLogs.length === 0 && !isLoading && (
              <div className="p-12 text-center text-slate-500">
                <ScrollText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="font-medium text-lg mb-2">Geen logs gevonden</h3>
                <p>Er zijn geen logs die overeenkomen met je zoekcriteria.</p>
              </div>
            )}
            
            {isLoading && (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-slate-500">Logs laden...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
