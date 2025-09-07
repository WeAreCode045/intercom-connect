
import React, { useState, useEffect, useCallback } from "react";
import { Setting } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Mail,
  MessageCircle,
  Server,
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  Save,
  TestTube,
  Filter, // Added Filter icon
  XCircle // Added XCircle for removing filters
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { testImapConnection } from "@/api/functions";
import { testIntercomConnection } from "@/api/functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select components

const defaultSettings = {
  // IMAP Settings
  imap_host: '',
  imap_port: '993',
  imap_username: '',
  imap_password: '',
  imap_use_ssl: 'true',
  imap_tls_reject_unauthorized: 'true',
  imap_folder: 'INBOX',
  imap_connection_timeout: '30',

  // Intercom Settings
  intercom_token: '',
  intercom_workspace_id: '',

  // General Settings
  check_interval: '60',
  case_number_regex: 'Your case # ([A-Z0-9]+)',
  max_emails_per_run: '50',

  // Filter Settings
  global_filters: '[]', // Stores JSON string of filter rules
  filter_logic: 'AND' // 'AND' or 'OR'
};

// GlobalFilters component definition
const GlobalFilters = ({ settings, onSettingChange, isSaving, saveMessage }) => {
  const [filters, setFilters] = useState([]);
  const [filterLogic, setFilterLogic] = useState('AND');

  useEffect(() => {
    try {
      const parsedFilters = JSON.parse(settings.global_filters || '[]');
      setFilters(Array.isArray(parsedFilters) ? parsedFilters : []);
    } catch (error) {
      console.error("Failed to parse global_filters from settings:", error);
      setFilters([]);
    }
    setFilterLogic(settings.filter_logic || 'AND');
  }, [settings.global_filters, settings.filter_logic]);

  const handleAddFilter = () => {
    const newFilter = {
      id: crypto.randomUUID(),
      field: 'from',
      condition: 'contains',
      value: ''
    };
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    onSettingChange('global_filters', JSON.stringify(newFilters));
  };

  const handleUpdateFilter = (id, key, value) => {
    const newFilters = filters.map(filter =>
      filter.id === id ? { ...filter, [key]: value } : filter
    );
    setFilters(newFilters);
    onSettingChange('global_filters', JSON.stringify(newFilters));
  };

  const handleRemoveFilter = (id) => {
    const newFilters = filters.filter(filter => filter.id !== id);
    setFilters(newFilters);
    onSettingChange('global_filters', JSON.stringify(newFilters));
  };

  const handleLogicChange = (newLogic) => {
    setFilterLogic(newLogic);
    onSettingChange('filter_logic', newLogic);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Globale E-mail Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Definieer regels om inkomende e-mails te filteren op basis van afzender, onderwerp of inhoud.
            Alleen e-mails die aan deze regels voldoen, worden verwerkt.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="filter_logic">Filter Logica</Label>
          <Select value={filterLogic} onValueChange={handleLogicChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select logic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">Alle regels moeten voldoen (AND)</SelectItem>
              <SelectItem value="OR">Minimaal één regel moet voldoen (OR)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Kies of alle gedefinieerde regels moeten overeenkomen (AND) of slechts één van de regels (OR).
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          {filters.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nog geen filters toegevoegd.</p>
          )}

          {filters.map((filter, index) => (
            <div key={filter.id} className="flex flex-col sm:flex-row items-center gap-2 border p-3 rounded-lg">
              <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                {/* Field Selector */}
                <Select
                  value={filter.field}
                  onValueChange={(value) => handleUpdateFilter(filter.id, 'field', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Veld" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="from">Van</SelectItem>
                    <SelectItem value="to">Aan</SelectItem>
                    <SelectItem value="subject">Onderwerp</SelectItem>
                    <SelectItem value="body">Inhoud</SelectItem>
                  </SelectContent>
                </Select>

                {/* Condition Selector */}
                <Select
                  value={filter.condition}
                  onValueChange={(value) => handleUpdateFilter(filter.id, 'condition', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Conditie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Bevat</SelectItem>
                    <SelectItem value="does not contain">Bevat niet</SelectItem>
                  </SelectContent>
                </Select>

                {/* Value Input */}
                <Input
                  placeholder="Waarde"
                  value={filter.value || ''}
                  onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFilter(filter.id)}
                className="flex-shrink-0"
              >
                <XCircle className="h-5 w-5 text-red-500" />
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={handleAddFilter} className="w-full mt-4">
            Filter Toevoegen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState({});
  const [testResults, setTestResults] = useState({});
  const [saveMessage, setSaveMessage] = useState('');
  const [dbSettings, setDbSettings] = useState([]); // New state to hold original DB records

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsList = await Setting.list();
      setDbSettings(settingsList); // Store the original database records
      const settingsMap = {};

      settingsList.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });

      setSettings({ ...defaultSettings, ...settingsMap });
    } catch (error) {
      console.error('Fout bij laden instellingen:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const promises = Object.entries(settings).map(async ([key, value]) => {
        const existingSetting = dbSettings.find(s => s.key === key);
        const category = key.startsWith('imap_') ? 'imap' :
                         key.startsWith('intercom_') ? 'intercom' :
                         key.startsWith('filter_') || key === 'global_filters' ? 'filter' : // Added 'filter' category
                         'general';
        const isEncrypted = key.includes('password') || key.includes('token');

        const data = { key, value, category, is_encrypted: isEncrypted };

        if (existingSetting) {
          // Update existing setting if the value has changed
          if (existingSetting.value !== value) {
            return Setting.update(existingSetting.id, data);
          }
          // If value is unchanged, no action needed, resolve immediately
          return Promise.resolve();
        } else {
          // Create new setting
          return Setting.create(data);
        }
      });

      // Filter out any undefined/null results from promises (e.g., when no update was needed)
      await Promise.all(promises);

      // Reload settings from the database after saving to reflect current state and update dbSettings
      await loadSettings();

      setSaveMessage('Instellingen succesvol opgeslagen!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Fout bij opslaan:', error);
      setSaveMessage(`Fout bij opslaan instellingen: ${error.message}`);
    }

    setIsSaving(false);
  };

  const testConnection = async (type) => {
    setTestingConnection(prev => ({ ...prev, [type]: true }));
    setTestResults(prev => ({ ...prev, [type]: null }));
    
    try {
      let response;
      
      if (type === 'imap') {
        response = await testImapConnection({ settings });
      } else if (type === 'intercom') {
        // Pass the settings object for intercom test as well
        response = await testIntercomConnection({ settings });
      }
      
      setTestResults(prev => ({ 
        ...prev, 
        [type]: {
          success: response.data.success,
          message: response.data.message,
          details: response.data.details
        }
      }));
      
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [type]: {
          success: false,
          message: `Verbindingsfout: ${error.message || 'Onbekende fout'}`,
          details: error.response?.data?.details || error.message || null
        }
      }));
    }
    
    setTestingConnection(prev => ({ ...prev, [type]: false }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Instellingen</h1>
          <p className="text-slate-600 mt-1">Configureer je IMAP en Intercom verbindingen</p>
        </div>

        <Button
          onClick={saveSettings}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Opslaan...' : 'Opslaan'}
        </Button>
      </div>

      {saveMessage && (
        <Alert className={saveMessage.includes('succesvol') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {saveMessage.includes('succesvol') ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Belangrijk:</strong> Voor IMAP en Intercom integratie zijn backend functies vereist.
          Deze kunnen worden ingeschakeld via Dashboard → Settings → Backend Functions.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="imap" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4"> {/* Changed grid-cols-3 to grid-cols-4 */}
          <TabsTrigger value="imap" className="gap-2">
            <Mail className="w-4 h-4" />
            IMAP Server
          </TabsTrigger>
          <TabsTrigger value="intercom" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            Intercom API
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-2"> {/* New TabsTrigger for Filters */}
            <Filter className="w-4 h-4" />
            Filters
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <Server className="w-4 h-4" />
            Algemeen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imap">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  IMAP Server Configuratie
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('imap')}
                  disabled={testingConnection.imap}
                  className="gap-2"
                >
                  <TestTube className="w-4 h-4" />
                  {testingConnection.imap ? 'Testen...' : 'Test Verbinding'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResults.imap && (
                <Alert className={testResults.imap.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {testResults.imap.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription>
                    <strong>{testResults.imap.success ? 'Succes!' : 'Fout!'}</strong> {testResults.imap.message}
                    {testResults.imap.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm">Technische details</summary>
                        <pre className="text-xs mt-1 p-2 bg-white rounded border overflow-x-auto whitespace-pre-wrap">
                          {typeof testResults.imap.details === 'object' ? JSON.stringify(testResults.imap.details, null, 2) : testResults.imap.details}
                        </pre>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imap_host">IMAP Server</Label>
                  <Input
                    id="imap_host"
                    placeholder="imap.gmail.com"
                    value={settings.imap_host || ''}
                    onChange={(e) => handleInputChange('imap_host', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imap_port">Poort</Label>
                  <Input
                    id="imap_port"
                    placeholder="993"
                    value={settings.imap_port || ''}
                    onChange={(e) => handleInputChange('imap_port', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap_username">Gebruikersnaam</Label>
                <Input
                  id="imap_username"
                  placeholder="jouw-email@bedrijf.com"
                  value={settings.imap_username || ''}
                  onChange={(e) => handleInputChange('imap_username', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap_password">
                  Wachtwoord
                  <Badge variant="outline" className="ml-2">
                    <Shield className="w-3 h-3 mr-1" />
                    Versleuteld
                  </Badge>
                </Label>
                <Input
                  id="imap_password"
                  type="password"
                  placeholder="••••••••••"
                  value={settings.imap_password || ''}
                  onChange={(e) => handleInputChange('imap_password', e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Gebruik SSL/TLS</Label>
                  <p className="text-sm text-slate-500">
                    Voor versleutelde verbindingen (poort 993).
                  </p>
                </div>
                <Switch
                  checked={settings.imap_use_ssl === 'true'}
                  onCheckedChange={(checked) => handleInputChange('imap_use_ssl', checked ? 'true' : 'false')}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Valideer TLS Certificaat</Label>
                  <p className="text-sm text-slate-500">
                    Zet uit voor servers met self-signed certificaten.
                  </p>
                </div>
                <Switch
                  checked={settings.imap_tls_reject_unauthorized !== 'false'}
                  onCheckedChange={(checked) => handleInputChange('imap_tls_reject_unauthorized', checked ? 'true' : 'false')}
                />
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="imap_folder">IMAP Map</Label>
                  <Input
                    id="imap_folder"
                    placeholder="INBOX"
                    value={settings.imap_folder || ''}
                    onChange={(e) => handleInputChange('imap_folder', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imap_connection_timeout">Connection Timeout (seconden)</Label>
                  <Input
                    id="imap_connection_timeout"
                    type="number"
                    placeholder="30"
                    value={settings.imap_connection_timeout || ''}
                    onChange={(e) => handleInputChange('imap_connection_timeout', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intercom">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Intercom API Configuratie
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('intercom')}
                  disabled={testingConnection.intercom}
                  className="gap-2"
                >
                  <TestTube className="w-4 h-4" />
                  {testingConnection.intercom ? 'Testen...' : 'Test Verbinding'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResults.intercom && (
                <Alert className={testResults.intercom.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {testResults.intercom.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription>
                    <strong>{testResults.intercom.success ? 'Succes!' : 'Fout!'}</strong> {testResults.intercom.message}
                    {testResults.intercom.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm">Technische details</summary>
                        <pre className="text-xs mt-1 p-2 bg-white rounded border overflow-x-auto whitespace-pre-wrap">
                          {typeof testResults.intercom.details === 'object' ? JSON.stringify(testResults.intercom.details, null, 2) : testResults.intercom.details}
                        </pre>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="intercom_token">
                  API Token
                  <Badge variant="outline" className="ml-2">
                    <Shield className="w-3 h-3 mr-1" />
                    Versleuteld
                  </Badge>
                </Label>
                <Input
                  id="intercom_token"
                  type="password"
                  placeholder="dG9rXzEyMzQ1Njc4OTA:"
                  value={settings.intercom_token || ''}
                  onChange={(e) => handleInputChange('intercom_token', e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Je kunt je API token vinden in je Intercom instellingen onder Developer Hub → API Keys
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intercom_workspace_id">Workspace ID (optioneel)</Label>
                <Input
                  id="intercom_workspace_id"
                  placeholder="abc12345"
                  value={settings.intercom_workspace_id || ''}
                  onChange={(e) => handleInputChange('intercom_workspace_id', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New TabsContent for Filters */}
        <TabsContent value="filters">
          <GlobalFilters
            settings={settings}
            onSettingChange={handleInputChange}
            isSaving={isSaving}
            saveMessage={saveMessage}
          />
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Algemene Instellingen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="check_interval">Check Interval (seconden)</Label>
                  <Input
                    id="check_interval"
                    type="number"
                    placeholder="60"
                    value={settings.check_interval || ''}
                    onChange={(e) => handleInputChange('check_interval', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_emails_per_run">Max E-mails per Run</Label>
                  <Input
                    id="max_emails_per_run"
                    type="number"
                    placeholder="50"
                    value={settings.max_emails_per_run || ''}
                    onChange={(e) => handleInputChange('max_emails_per_run', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="case_number_regex">Case Nummer Regex</Label>
                <Input
                  id="case_number_regex"
                  placeholder="Your case # ([A-Z0-9]+)"
                  value={settings.case_number_regex || ''}
                  onChange={(e) => handleInputChange('case_number_regex', e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Reguliere expressie om case nummers uit e-mail onderwerpen te extracten
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
