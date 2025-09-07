import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Plus, X, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const filterTypes = [
  { value: 'from', label: 'Afzender' },
  { value: 'subject_starts', label: 'Onderwerp begint met' },
  { value: 'subject_contains', label: 'Onderwerp bevat' },
  { value: 'body_contains', label: 'Inhoud bevat' },
  { value: 'newer_than_days', label: 'Nieuwer dan (dagen)' },
  { value: 'older_than_days', label: 'Ouder dan (dagen)' }
];

export default function GlobalFilters({ settings, onSettingChange, onSave, isSaving, saveMessage }) {
  const [filters, setFilters] = useState([]);
  const [filterLogic, setFilterLogic] = useState('AND');

  useEffect(() => {
    // Parse filters uit settings
    try {
      const filtersJson = settings.global_filters || '[]';
      setFilters(JSON.parse(filtersJson));
    } catch {
      setFilters([]);
    }
    
    setFilterLogic(settings.filter_logic || 'AND');
  }, [settings]);

  const addFilter = () => {
    const newFilter = { 
      id: Date.now(), 
      type: 'from', 
      value: '' 
    };
    const newFilters = [...filters, newFilter];
    setFilters(newFilters);
    onSettingChange('global_filters', JSON.stringify(newFilters));
  };

  const updateFilter = (filterId, field, value) => {
    const newFilters = filters.map(f =>
      f.id === filterId ? { ...f, [field]: value } : f
    );
    setFilters(newFilters);
    onSettingChange('global_filters', JSON.stringify(newFilters));
  };

  const removeFilter = (filterId) => {
    const newFilters = filters.filter(f => f.id !== filterId);
    setFilters(newFilters);
    onSettingChange('global_filters', JSON.stringify(newFilters));
  };

  const handleLogicChange = (logic) => {
    setFilterLogic(logic);
    onSettingChange('filter_logic', logic);
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
        {saveMessage && (
          <Alert className={saveMessage.includes('succesvol') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription>{saveMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Filter Logica</Label>
            <Select value={filterLogic} onValueChange={handleLogicChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">Alle filters (AND)</SelectItem>
                <SelectItem value="OR">Een van de filters (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">
              <strong>Filter Logica:</strong>
            </p>
            {filterLogic === 'AND' ? (
              <p className="text-sm text-slate-700">
                E-mails worden alleen verwerkt als ze voldoen aan <strong>alle</strong> onderstaande voorwaarden.
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                E-mails worden verwerkt als ze voldoen aan <strong>ten minste één</strong> van de onderstaande voorwaarden.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Filters ({filters.length})</Label>
            
            {filters.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                <Filter className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Nog geen filters ingesteld</p>
                <p className="text-xs mt-1">Zonder filters worden alle ongelezen e-mails verwerkt</p>
              </div>
            ) : (
              filters.map((filter) => (
                <div key={filter.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                  <Select
                    value={filter.type}
                    onValueChange={(value) => updateFilter(filter.id, 'type', value)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Waarde"
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                    className="flex-1"
                  />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilter(filter.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={addFilter} className="gap-2">
              <Plus className="w-4 h-4" />
              Filter Toevoegen
            </Button>

            <Button
              onClick={onSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Opslaan...' : 'Filters Opslaan'}
            </Button>
          </div>
        </div>

        {filters.length > 0 && (
          <div className="border-t pt-4">
            <Label className="text-sm font-medium text-slate-600">Preview:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {filters.map((filter, index) => (
                <React.Fragment key={filter.id}>
                  <Badge variant="secondary" className="font-normal">
                    <span className="font-semibold mr-1.5">
                      {filterTypes.find(t => t.value === filter.type)?.label}:
                    </span>
                    <span>{filter.value}</span>
                  </Badge>
                  {index < filters.length - 1 && (
                    <Badge className="bg-blue-100 text-blue-800 font-mono">
                      {filterLogic}
                    </Badge>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}