import React, { useState, useEffect } from "react";
import { UnlinkedCase } from "@/api/entities";
import { ConversationStatus } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { findUnlinkedCases } from "@/api/functions";
import { linkCaseToConversation } from "@/api/functions";

export default function UnlinkedCases({ onCasesLinked }) {
  const [unlinkedCases, setUnlinkedCases] = useState([]);
  const [openConversations, setOpenConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinding, setIsFinding] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCase, setCurrentCase] = useState(null);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [casesData, convosData] = await Promise.all([
        UnlinkedCase.list('-created_date'),
        ConversationStatus.filter({ conversation_state: 'open' })
      ]);
      setUnlinkedCases(casesData);
      setOpenConversations(convosData.filter(c => !c.case_number));
    } catch (error) {
      console.error("Fout bij laden data:", error);
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    loadData();
  }, []);

  const handleFindCases = async () => {
    setIsFinding(true);
    try {
      await findUnlinkedCases();
      await loadData();
    } catch(error) {
      console.error("Fout bij zoeken naar cases", error);
    }
    setIsFinding(false);
  };
  
  const handleLinkCase = async () => {
    if (!currentCase || !selectedConversationId) return;
    
    setIsLinking(true);
    try {
      await linkCaseToConversation({
        caseNumber: currentCase.case_number,
        conversationId: selectedConversationId,
        unlinkedCaseId: currentCase.id,
      });
      setIsDialogOpen(false);
      setCurrentCase(null);
      setSelectedConversationId(null);
      await loadData();
      if(onCasesLinked) onCasesLinked();
    } catch(error) {
      console.error("Fout bij koppelen case", error);
    }
    setIsLinking(false);
  };
  
  const openLinkDialog = (unlinkedCase) => {
    setCurrentCase(unlinkedCase);
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Ongekoppelde Cases ({unlinkedCases.length})
        </CardTitle>
        <Button onClick={handleFindCases} disabled={isFinding} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFinding ? 'animate-spin' : ''}`} />
          {isFinding ? 'Zoeken...' : 'Zoek naar Nieuwe Cases'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Laden...</p> : (
          <div className="space-y-3">
            {unlinkedCases.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Geen ongekoppelde cases gevonden.</p>
            ) : (
              unlinkedCases.map(uc => (
                <div key={uc.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                  <div>
                    <Badge className="font-mono text-lg">#{uc.case_number}</Badge>
                    <p className="text-sm text-slate-600 mt-1">Gevonden in e-mail: "{uc.source_email_subject}"</p>
                    <p className="text-xs text-slate-400">
                      Van: {uc.source_email_sender} op {uc.email_received_date ? format(new Date(uc.email_received_date), 'dd MMM yyyy', { locale: nl }) : ''}
                    </p>
                  </div>
                  <Button onClick={() => openLinkDialog(uc)} className="gap-2">
                    <Link className="w-4 h-4" />
                    Koppelen
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Koppel Case #{currentCase?.case_number} aan Conversatie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p>Selecteer een openstaande Intercom conversatie om dit casenummer aan toe te voegen.</p>
              <Select onValueChange={setSelectedConversationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies een conversatie..." />
                </SelectTrigger>
                <SelectContent>
                  {openConversations.map(conv => (
                    <SelectItem key={conv.id} value={conv.intercom_conversation_id}>
                      <span className="font-medium">{(conv.conversation_subject || 'Geen onderwerp').substring(0, 50)}...</span>
                      <span className="text-slate-500 ml-2">(van {conv.author_name})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleLinkCase} disabled={isLinking || !selectedConversationId} className="w-full">
                {isLinking ? 'Koppelen...' : `Bevestig Koppeling`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}