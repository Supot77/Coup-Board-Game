// components/ActionAlert.jsx
import React from 'react';
import { Player } from '../types';

interface ActionAlertProps {
  gameState: string;
  pendingAction: {
    sourceId: string;
    targetId?: string;
    blockerId?: string;
    actionName: string;
    blockCharacter?: string;
  };
  players: Player[];
}

export default function ActionAlert({ gameState, pendingAction, players }: ActionAlertProps) {
  // หากไม่มีแอคชั่นค้างอยู่ หรือไม่ได้อยู่ในสถานะรอการตอบสนอง ให้ซ่อนป้ายนี้ไป
  if (!pendingAction) return null;
  if (gameState !== "waiting_for_responses" && gameState !== "waiting_for_block_responses") return null;

  const sourcePlayer = players.find(p => p.id === pendingAction.sourceId);
  const targetPlayer = pendingAction.targetId ? players.find(p => p.id === pendingAction.targetId) : null;
  const blockerPlayer = pendingAction.blockerId ? players.find(p => p.id === pendingAction.blockerId) : null;

  // กำหนดสีพื้นหลัง: สีแดงสำหรับแอคชั่นโจมตี/ทั่วไป, สีน้ำเงินสำหรับการบล็อก
  const bgColor = gameState === "waiting_for_block_responses" ? 'rgba(41, 128, 185, 0.95)' : 'rgba(192, 57, 43, 0.95)';

  return (
    <div style={{
      backgroundColor: bgColor,
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '20px',
      textAlign: 'center',
      border: '3px solid var(--gold)',
      boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
      transition: 'all 0.3s ease'
    }}>
      <h2 style={{ margin: 0, fontSize: '26px', color: 'var(--gold)', textShadow: '1px 1px 2px black' }}>
        {gameState === "waiting_for_responses" && "⚠️ มีการประกาศใช้แอคชั่น!"}
        {gameState === "waiting_for_block_responses" && "🛡️ มีการประกาศบล็อก!"}
      </h2>
      
      <p style={{ fontSize: '20px', margin: '15px 0 0 0', fontWeight: '500' }}>
        {gameState === "waiting_for_responses" && (
          <>
            <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{sourcePlayer?.name}</span> 
            {" ประกาศใช้ "} 
            <span style={{ backgroundColor: 'black', padding: '3px 8px', borderRadius: '5px' }}>{pendingAction.actionName}</span>
            {targetPlayer ? (
              <>
                {" ใส่ "}
                <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{targetPlayer.name}</span>
              </>
            ) : ""}
          </>
        )}
        
        {gameState === "waiting_for_block_responses" && (
          <>
            <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{blockerPlayer?.name}</span> 
            {" อ้างว่าเป็น "}
            <span style={{ backgroundColor: 'black', padding: '3px 8px', borderRadius: '5px' }}>{pendingAction.blockCharacter}</span>
            {" เพื่อบล็อกแอคชั่นนี้!"}
          </>
        )}
      </p>
    </div>
  );
}