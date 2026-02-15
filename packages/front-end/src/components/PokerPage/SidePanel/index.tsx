import { PERSONAS } from "../../../personas";
import type { Player } from "../../../types";
import { ProviderIcon } from "../ProviderIcon";
import styles from "./SidePanel.module.css";

export function SidePanel({
  speakingPlayer,
  speakingColor,
  analysisText,
  isApiError,
}: {
  speakingPlayer: Player | null;
  speakingColor: string | undefined;
  analysisText: string | null;
  isApiError: boolean;
}) {
  return (
    <div className={styles.sidePanel}>
      <div
        className={`${styles.sidePanelContent} ${speakingPlayer && analysisText ? styles.sidePanelVisible : ""}`}
      >
        {speakingPlayer && (
          <>
            <div
              className={styles.sidePanelAvatar}
              style={{ "--seat-color": speakingColor } as React.CSSProperties}
            >
              <ProviderIcon
                avatar={speakingPlayer.avatar}
                style={{ width: "60%", height: "60%" }}
              />
            </div>
            <div className={styles.sidePanelName}>{speakingPlayer.name}</div>
            {speakingPlayer.persona &&
              PERSONAS[speakingPlayer.persona] && (
                <div
                  className={styles.personaBlock}
                  style={{
                    color: PERSONAS[speakingPlayer.persona].color,
                  }}
                >
                  <div className={styles.personaName}>
                    {PERSONAS[speakingPlayer.persona].emoji}{" "}
                    {PERSONAS[speakingPlayer.persona].name}
                  </div>
                  <div className={styles.personaTags}>
                    {PERSONAS[speakingPlayer.persona].tags.join(" \u00B7 ")}
                  </div>
                </div>
              )}
          </>
        )}
        {isApiError && <div className={styles.apiErrorPill}>API Error</div>}
        {analysisText && (
          <div className={styles.sidePanelText}>{analysisText}</div>
        )}
      </div>
    </div>
  );
}
