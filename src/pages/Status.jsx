
import React, { useState, useEffect, useCallback } from "react";
import { ConversationStatus, EmailLog } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Search,
  RefreshCw,
  ExternalLink,
  Calendar,
  User,
  Mail,
  MessageCircle,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { syncConversations } from "@/api/functions";
import UnlinkedCases from "../components/status/UnlinkedCases"; // Import de nieuwe component

export default function Status() {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [relatedEmails, setRelatedEmails] = useState({});
  const [loadingEmails, setLoadingEmails] = useState(new Set());

  const filterConversations = useCallback(() => {
    let filtered = conversations;

    if (searchTerm) {
      filtered = filtered.filter(conv =>
        conv.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.conversation_subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.author_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(conv => conv.conversation_state === statusFilter);
    }

    if (accountFilter !== 'all') {
      filtered = filtered.filter(conv => conv.mail_account_name === accountFilter);
    }

    setFilteredConversations(filtered);
  }, [conversations, searchTerm, statusFilter, accountFilter]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [filterConversations]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const data = await ConversationStatus.list('-conversation_updated_date', 200);
      setConversations(data);
    } catch (error) {
      console.error('Fout bij laden conversaties:', error);
    }
    setIsLoading(false);
  };

  const handleRefreshAll = async () => {
    await loadConversations();
  };

  const syncConversationsHandler = async () => {
    setIsSyncing(true);
    try {
      const { data } = await syncConversations();
      if (data.success) {
        await loadConversations();
      }
    } catch (error) {
      console.error('Fout bij synchroniseren:', error);
    }
    setIsSyncing(false);
  };

  const loadRelatedEmails = async (caseNumber) => {
    if (relatedEmails[caseNumber]) {
      return;
    }

    setLoadingEmails(prev => new Set([...prev, caseNumber]));
    
    try {
      const emails = await EmailLog.filter({ 
        case_number: caseNumber,
        status: 'processed'
      }, '-created_date', 50);
      
      const connectedEmails = emails.filter(email => email.intercom_conversation_id);
      
      setRelatedEmails(prev => ({
        ...prev,
        [caseNumber]: connectedEmails
      }));
    } catch (error) {
      console.error('Fout bij laden gerelateerde e-mails:', error);
      setRelatedEmails(prev => ({
        ...prev,
        [caseNumber]: []
      }));
    }
    
    setLoadingEmails(prev => {
      const newSet = new Set(prev);
      newSet.delete(caseNumber);
      return newSet;
    });
  };

  const toggleRow = async (conversationId, caseNumber) => {
    const newExpandedRows = new Set(expandedRows);
    
    if (expandedRows.has(conversationId)) {
      newExpandedRows.delete(conversationId);
    } else {
      newExpandedRows.add(conversationId);
      await loadRelatedEmails(caseNumber);
    }
    
    setExpandedRows(newExpandedRows);
  };

  const getStatusColor = (state) => {
    switch (state) {
      case 'open': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'snoozed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getEmailStatusColor = (status) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'case_not_found': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEmailStatusIcon = (status) => {
    switch (status) {
      case 'processed': return <CheckCircle2 className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'case_not_found': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const uniqueAccounts = [...new Set(conversations.map(c => c.mail_account_name).filter(Boolean))];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Conversatie Status
          </h1>
          <p className="text-slate-600 mt-1">Overzicht van alle actieve conversaties met case nummers</p>
        </div>
        <div className="flex justify-start md:justify-end">
          <Button 
            onClick={syncConversationsHandler} 
            disabled={isSyncing}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchroniseren...' : 'Sync met Intercom'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-500">Totaal Conversaties</p>
                <p className="text-2xl font-bold">{conversations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-slate-500">Actieve Conversaties</p>
                <p className="text-2xl font-bold">{conversations.filter(c => c.conversation_state === 'open').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-slate-500">Mail Accounts</p>
                <p className="text-2xl font-bold">{uniqueAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unlinked Cases Component */}
      <UnlinkedCases onCasesLinked={handleRefreshAll} />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Zoek op case nummer, onderwerp, auteur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Gesloten</SelectItem>
                <SelectItem value="snoozed">Uitgesteld</SelectItem>
              </SelectContent>
            </Select>

            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Account filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle accounts</SelectItem>
                {uniqueAccounts.map(account => (
                  <SelectItem key={account} value={account}>{account}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
            <span>Gevonden: {filteredConversations.length} conversaties</span>
          </div>
        </CardContent>
      </Card>

      {/* Conversation List */}
      <Card>
        <CardHeader>
          <CardTitle>Conversatie Overzicht</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[40px_1fr_180px_180px_60px] gap-4 px-6 py-3 border-b bg-slate-50 text-sm font-medium text-slate-600">
            <div className="col-start-2">Case / Onderwerp</div>
            <div>Auteur</div>
            <div>Laatste Update</div>
            <div className="text-center">Status</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredConversations.map((conversation) => {
              const isExpanded = expandedRows.has(conversation.id);
              const emailsForCase = relatedEmails[conversation.case_number] || [];
              const isLoadingCaseEmails = loadingEmails.has(conversation.case_number);
              
              return (
                <Collapsible key={conversation.id} open={isExpanded} onOpenChange={() => toggleRow(conversation.id, conversation.case_number)}>
                  <CollapsibleTrigger asChild>
                    <div className="w-full text-left hover:bg-slate-50/70 transition-colors cursor-pointer">
                      <div className="px-4 pt-4 pb-2 border-b border-slate-100">
                        <h3 className="font-medium text-slate-900 text-base leading-relaxed">
                          {(conversation.conversation_subject || 'Geen onderwerp').replace(/<[^>]*>?/gm, '')}
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-[40px_1fr_auto] md:grid-cols-[40px_1fr_180px_180px_60px] gap-4 items-center p-4">
                        <div className="flex items-center justify-center">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-blue-700 border-blue-200 bg-blue-50">
                              #{conversation.case_number}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 md:hidden truncate mt-1">
                            {format(new Date(conversation.conversation_updated_date), 'dd MMM, HH:mm', { locale: nl })}
                          </p>
                        </div>
                        
                        <div className="hidden md:flex flex-col">
                          <span className="font-medium text-slate-800 truncate">{conversation.author_name}</span>
                          <span className="text-xs text-slate-500 truncate">{conversation.author_email}</span>
                        </div>

                        <div className="hidden md:flex flex-col">
                          <span className="text-sm text-slate-800">
                            {format(new Date(conversation.conversation_updated_date), 'dd MMMM yyyy', { locale: nl })}
                          </span>
                          <span className="text-xs text-slate-500">
                            {format(new Date(conversation.conversation_updated_date), 'HH:mm', { locale: nl })}
                          </span>
                        </div>

                        <div className="hidden md:flex justify-center">
                          <Badge className={`${getStatusColor(conversation.conversation_state)} text-xs`}>
                            {conversation.conversation_state || 'onbekend'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-end md:hidden">
                          <Badge className={`${getStatusColor(conversation.conversation_state)} text-xs`}>
                            {conversation.conversation_state || 'onbekend'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="bg-slate-50/70 p-4 border-t border-slate-200">
                      <div className="bg-white rounded-lg p-4 border shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Gerelateerde E-mails ({emailsForCase.length})
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 hover:text-blue-900 hover:bg-blue-50 gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://app.intercom.io/a/inbox/conversation/${conversation.intercom_conversation_id}`, '_blank');
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Bekijk in Intercom
                          </Button>
                        </div>
                        
                        {isLoadingCaseEmails && (
                          <div className="flex items-center justify-center py-8 text-slate-500">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            E-mails laden...
                          </div>
                        )}
                        
                        {!isLoadingCaseEmails && emailsForCase.length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                            <p>Geen gerelateerde e-mails gevonden voor case #{conversation.case_number}</p>
                          </div>
                        )}
                        
                        {!isLoadingCaseEmails && emailsForCase.length > 0 && (
                          <div className="space-y-3">
                            {emailsForCase.map((email) => (
                              <div key={email.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <Badge className={`${getEmailStatusColor(email.status)} border flex items-center gap-1 text-xs`}>
                                        {getEmailStatusIcon(email.status)}
                                        {email.status}
                                      </Badge>
                                      {email.processing_time && (
                                        <Badge variant="outline" className="text-xs">
                                          {email.processing_time}ms
                                        </Badge>
                                      )}
                                      {email.mail_account_name && (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                          <Mail className="w-3 h-3" />
                                          {email.mail_account_name}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <h5 className="font-medium text-slate-900 mb-1 truncate">
                                      {email.email_subject}
                                    </h5>
                                    
                                    <p className="text-sm text-slate-500 mb-1">
                                      Van: {email.sender}
                                    </p>
                                    
                                    {email.error_message && (
                                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                                        {email.error_message}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="text-right text-xs text-slate-500">
                                    <p>{format(new Date(email.created_date), 'dd MMM', { locale: nl })}</p>
                                    <p>{format(new Date(email.created_date), 'HH:mm', { locale: nl })}</p>
                                  </div>
                                </div>
                                
                                {email.email_content && (
                                  <details className="mt-3">
                                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                      Bekijk e-mail inhoud
                                    </summary>
                                    <div className="mt-2 p-3 bg-slate-50 rounded text-xs leading-relaxed max-h-48 overflow-y-auto">
                                      <pre className="whitespace-pre-wrap font-sans">{email.email_content.replace(/<[^>]*>?/gm, '')}</pre>
                                    </div>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {filteredConversations.length === 0 && !isLoading && (
              <div className="p-12 text-center text-slate-500">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="font-medium text-lg mb-2">Geen conversaties gevonden</h3>
                <p>Er zijn geen conversaties die overeenkomen met je zoekcriteria.</p>
                <Button 
                  onClick={syncConversationsHandler}
                  disabled={isSyncing}
                  className="mt-4 gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync met Intercom
                </Button>
              </div>
            )}
            
            {isLoading && (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-slate-500">Conversaties laden...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
