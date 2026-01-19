import { useSettings, useUpdateSetting } from "@/hooks/use-dashboard";
import { Sidebar } from "@/components/Sidebar";
import { Settings as SettingsIcon, Save, Key, Command, Lock, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface SettingFieldProps {
  label: string;
  settingKey: string;
  description: string;
  icon: React.ReactNode;
  placeholder?: string;
  type?: string;
  currentValue: string;
  onSave: (key: string, value: string) => void;
  isSaving: boolean;
}

function SettingField({ label, settingKey, description, icon, placeholder, type = "text", currentValue, onSave, isSaving }: SettingFieldProps) {
  const [value, setValue] = useState(currentValue);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setIsDirty(e.target.value !== currentValue);
  };

  const handleSave = () => {
    onSave(settingKey, value);
    setIsDirty(false);
  };

  return (
    <div className="p-6 bg-card/40 border border-white/10 rounded-xl hover:border-primary/30 transition-all duration-300 backdrop-blur-sm group">
      <div className="flex gap-4">
        <div className="p-3 bg-black/20 rounded-lg border border-white/5 text-primary h-fit">
          {icon}
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-display font-bold tracking-wide text-lg">{label}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          
          <div className="flex gap-3">
            <input
              type={type}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-mono text-sm transition-all text-white"
            />
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                isDirty 
                  ? "bg-primary text-white hover:bg-primary/90 hover:shadow-[0_0_15px_-5px_hsl(var(--primary))]" 
                  : "bg-white/5 text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isDirty ? "SAVE" : "SAVED"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const { toast } = useToast();

  const handleSave = async (key: string, value: string) => {
    try {
      await updateSetting.mutateAsync({ key, value });
      toast({
        title: "Configuration Updated",
        description: `Successfully updated ${key}.`,
        className: "bg-secondary text-black font-bold border-none",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not save configuration. Check connection.",
        variant: "destructive",
      });
    }
  };

  const getSettingValue = (key: string) => {
    return settings?.find(s => s.key === key)?.value || "";
  };

  return (
    <div className="min-h-screen bg-background grid-bg text-foreground pl-64">
      <Sidebar />
      
      <main className="p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-end pb-6 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold mb-2">CONFIGURATION</h2>
            <p className="text-muted-foreground font-body">Manage bot parameters and access controls</p>
          </div>
          <div className="p-2 bg-accent/10 border border-accent/20 rounded text-accent animate-pulse">
            <SettingsIcon className="w-6 h-6" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <SettingField
              label="Command Prefix"
              settingKey="prefix"
              description="The character used to trigger bot commands (e.g., !, ?, /)"
              icon={<Command className="w-6 h-6" />}
              placeholder="!"
              currentValue={getSettingValue("prefix")}
              onSave={handleSave}
              isSaving={updateSetting.isPending}
            />

            <SettingField
              label="Bot Name"
              settingKey="botName"
              description="Display name for the bot in dashboard logs"
              icon={<Bot className="w-6 h-6" />}
              placeholder="Nexus Bot"
              currentValue={getSettingValue("botName")}
              onSave={handleSave}
              isSaving={updateSetting.isPending}
            />

            <SettingField
              label="Owner ID"
              settingKey="ownerId"
              description="Discord User ID of the primary administrator"
              icon={<Key className="w-6 h-6" />}
              placeholder="123456789..."
              currentValue={getSettingValue("ownerId")}
              onSave={handleSave}
              isSaving={updateSetting.isPending}
            />

            <SettingField
              label="API Key"
              settingKey="apiKey"
              description="Secret key for external integrations (Hidden)"
              icon={<Lock className="w-6 h-6" />}
              type="password"
              placeholder="••••••••••••••"
              currentValue={getSettingValue("apiKey")}
              onSave={handleSave}
              isSaving={updateSetting.isPending}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
