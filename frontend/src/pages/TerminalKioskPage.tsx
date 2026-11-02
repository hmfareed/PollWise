import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Monitor, RefreshCw, AlertCircle, ShieldCheck, CheckCircle2, Wifi } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { VotingBoothPage } from "./VotingBoothPage";

export const TerminalKioskPage: React.FC = () => {
  const { terminalId = "" } = useParams<{ terminalId: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const electionIdFromUrl = searchParams.get("election_id") || "";

  const [terminalToken, setTerminalToken] = useState<string>(() => {
    return tokenFromUrl || localStorage.getItem(`pw_term_token_${terminalId}`) || "";
  });

  const [currentStatus, setCurrentStatus] = useState<string>("idle");
  const [supervisorNotice, setSupervisorNotice] = useState<string | null>(null);
  const [isHeartbeatOk, setIsHeartbeatOk] = useState<boolean>(true);
  const [sessionKey, setSessionKey] = useState<number>(0);

  useEffect(() => {
    if (tokenFromUrl) {
      localStorage.setItem(`pw_term_token_${terminalId}`, tokenFromUrl);
      setTerminalToken(tokenFromUrl);
    }
  }, [terminalId, tokenFromUrl]);

  // Execute terminal reset
  const handleReset = useCallback((noticeText: string) => {
    setSessionKey((prev) => prev + 1);
    setCurrentStatus("idle");
    setSupervisorNotice(noticeText);
    setTimeout(() => {
      setSupervisorNotice(null);
    }, 6000);
  }, []);

  // Heartbeat loop
  useEffect(() => {
    if (!terminalId) return;

    let isMounted = true;
    const sendHeartbeat = async () => {
      try {
        const res = await apiClient.terminalHeartbeat(terminalId, terminalToken, currentStatus);
        if (!isMounted) return;
        setIsHeartbeatOk(true);

        if (res.command === "reset") {
          handleReset("Terminal Reset by Supervisor");
        }
      } catch {
        if (!isMounted) return;
        setIsHeartbeatOk(false);
      }
    };

    // Immediate first tick
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [terminalId, terminalToken, currentStatus, handleReset]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Supervised Terminal Top Banner */}
      <header className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between text-xs select-none sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-foreground">
            <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Voting Centre Terminal Kiosk</span>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <span className="font-mono text-muted-foreground hidden sm:inline">
            Terminal: {terminalId}
          </span>

          <Badge variant={isHeartbeatOk ? "default" : "destructive"} className="text-[10px] h-5 gap-1">
            <Wifi className="w-3 h-3" />
            {isHeartbeatOk ? "Live" : "Offline"}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
            Status: {currentStatus}
          </Badge>

          {/* Supervisor Emergency Reset Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleReset("Terminal cleared for next voter")}
            className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1 px-2.5"
            title="Reset Terminal & Clear Session"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Terminal
          </Button>
        </div>
      </header>

      {/* Supervisor Notification Banner */}
      {supervisorNotice && (
        <div className="bg-blue-600 text-white px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-md animate-fade-in">
          <AlertCircle className="w-4 h-4" />
          <span>{supervisorNotice}</span>
        </div>
      )}

      {/* Kiosk Voting Booth Content */}
      <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto">
        <VotingBoothPage key={sessionKey} terminalToken={terminalToken} />
      </main>
    </div>
  );
};
