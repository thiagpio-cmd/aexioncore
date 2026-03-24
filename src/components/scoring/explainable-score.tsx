import React from "react";
import { type ScoreResult } from "@/lib/scoring/engine";

interface ExplainableScoreProps {
  scoreData: ScoreResult;
  type: "Fit" | "Probability";
}

export function ExplainableScore({ scoreData, type }: ExplainableScoreProps) {
  const { score, persona, signals, risks } = scoreData;

  // Visuals for score
  const getScoreColor = () => {
    if (score >= 70) return "text-primary border-primary/20 bg-primary/5";
    if (score >= 40) return "text-warning border-warning/20 bg-warning/5";
    return "text-danger border-danger/20 bg-danger/5";
  };

  const getScoreBg = () => {
    if (score >= 70) return "bg-primary-light";
    if (score >= 40) return "bg-warning/10";
    return "bg-danger-light";
  };

  return (
    <div className={`rounded-xl border ${getScoreColor()} overflow-hidden mb-6`}>
      <div className={`p-4 flex items-center justify-between border-b ${getScoreColor()}`}>
        <div>
          <h3 className="text-sm font-semibold capitalize">{type} Score</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Heuristic Rule Engine
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Persona</p>
            <p className="text-sm font-semibold">{persona}</p>
          </div>
          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-xl ${getScoreBg()}`}>
            {score}
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-background/50">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Positive Signals
          </h4>
          {signals.positive.length > 0 ? (
            <ul className="space-y-1">
              {signals.positive.map((signal, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-[2px]">•</span> <span>{signal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No positive signals detected.</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warning mb-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Negative Signals
          </h4>
          {signals.negative.length > 0 ? (
            <ul className="space-y-1">
              {signals.negative.map((signal, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-warning mt-[2px]">•</span> <span>{signal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No negative signals detected.</p>
          )}

          {risks.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-danger mb-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Active Risks
              </h4>
              <ul className="space-y-1 border-l-2 border-danger pl-2">
                {risks.map((risk, idx) => (
                  <li key={idx} className="text-xs text-danger font-medium flex items-start gap-2">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
