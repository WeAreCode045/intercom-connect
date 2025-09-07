
import React, { useState, useEffect } from "react";
import { EmailLog, Setting } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Settings,
  TrendingUp,
  MessageCircle,
  Server,
  AlertTriangle,
  Trash2 // Added Trash2 import
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import EmailFetcher from "../components/dashboard/EmailFetcher";
import N8nImport from "../components/dashboard/N8nImport";

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0,
    success: 0,
    failed: 0,
    pending: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logData, settingData] = await Promise.all([
        EmailLog.list('-created_date', 50),
        Setting.list()
      ]);
      
      setLogs(logData);
      setSettings(settingData);
      
      // Bereken statistieken
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayLogs = logData.filter(log => 
        new Date(log.created_date) >= today
      );
      
      setStats({
        today: todayLogs.length,
        success: logData.filter(log => log.status === 'processed').length,
        failed: logData.filter(log => log.status === 'failed').length,
        pending: logData.filter(log => log.status === 'pending').length
      });
    } catch (error) {
      console.error('Fout bij laden data:', error);
    }
    setIsLoading(false);
  };

  const handleEmailProcessed = () => {
    // Herlaad data na verwerking van e-mail
    loadData();
  };

  const handleDeleteLog = async (logId) => {
    try {
      await EmailLog.delete(logId);
      // Herlaad de logs lokaal zonder de server opnieuw te raadplegen voor een snelle UI update
      setLogs(currentLogs => currentLogs.filter(log => log.id !== logId));
    } catch (error) {
      console.error('Fout bij verwijderen log:', error);
      // Optioneel: toon een foutmelding aan de gebruiker
    }
  };

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

  const isConfigured = settings.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Overzicht van e-mail naar Intercom integratie</p>
        </div>
        
        {!isConfigured && (
          <Link to={createPageUrl("Settings")}>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Settings className="w-4 h-4" />
              Configureren
            </Button>
          </Link>
        )}
      </div>

      {/* Configuration Warning */}
      {!isConfigured && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-900">Configuratie Vereist</h3>
                <p className="text-orange-700 mt-1">
                  Configureer eerst je IMAP en Intercom instellingen om te beginnen met e-mail verwerking.
                </p>
              </div>
              <Link to={createPageUrl("Settings")}>
                <Button variant="outline" className="ml-auto border-orange-300 text-orange-700 hover:bg-orange-100">
                  Instellingen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-6 -translate-y-6 bg-blue-500 rounded-full opacity-10" />
          <CardHeader className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Vandaag Verwerkt</p>
                <CardTitle className="text-3xl font-bold mt-2">{stats.today}</CardTitle>
              </div>
              <div className="p-3 rounded-xl bg-blue-500 bg-opacity-20">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-6 -translate-y-6 bg-green-500 rounded-full opacity-10" />
          <CardHeader className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Succesvol</p>
                <CardTitle className="text-3xl font-bold mt-2">{stats.success}</CardTitle>
              </div>
              <div className="p-3 rounded-xl bg-green-500 bg-opacity-20">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-6 -translate-y-6 bg-red-500 rounded-full opacity-10" />
          <CardHeader className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Mislukt</p>
                <CardTitle className="text-3xl font-bold mt-2">{stats.failed}</CardTitle>
              </div>
              <div className="p-3 rounded-xl bg-red-500 bg-opacity-20">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-6 -translate-y-6 bg-yellow-500 rounded-full opacity-10" />
          <CardHeader className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">In Behandeling</p>
                <CardTitle className="text-3xl font-bold mt-2">{stats.pending}</CardTitle>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500 bg-opacity-20">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Recente Activiteit
                </CardTitle>
                <Link to={createPageUrl("Logs")}>
                  <Button variant="outline" size="sm">Alle Logs</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {logs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${getStatusColor(log.status)} border flex items-center gap-1`}>
                            {getStatusIcon(log.status)}
                            {log.status}
                          </Badge>
                          {log.case_number && (
                            <Badge variant="outline" className="text-xs">
                              #{log.case_number}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-slate-900 truncate">{log.email_subject}</p>
                        <p className="text-sm text-slate-500">Van: {log.sender}</p>
                        {log.error_message && (
                          <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                        )}
                      </div>
                      <div className="flex items-center">
                        <div className="text-xs text-slate-500 text-right mr-2">
                          {format(new Date(log.created_date), 'HH:mm', { locale: nl })}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteLog(log.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {logs.length === 0 && !isLoading && (
                  <div className="p-8 text-center text-slate-500">
                    <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Nog geen e-mails verwerkt</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Email Fetcher Component */}
          <EmailFetcher onEmailProcessed={handleEmailProcessed} />

          {/* N8n Import Component */}
          <N8nImport onEmailsProcessed={handleEmailProcessed} />
        </div>

        {/* Right Column - Status and Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">IMAP Verbinding</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs text-green-600 font-medium">Actief</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Intercom API</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs text-green-600 font-medium">Actief</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Laatste Check</span>
                <span className="text-xs text-slate-500">2 minuten geleden</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Snelle Acties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to={createPageUrl("Settings")} className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Settings className="w-4 h-4" />
                  Instellingen Beheren
                </Button>
              </Link>
              
              <Button variant="outline" className="w-full justify-start gap-2" disabled>
                <Mail className="w-4 h-4" />
                Handmatige Sync
              </Button>
              
              <Link to={createPageUrl("Logs")} className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Volledige Logs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
