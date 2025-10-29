"use client";

import { useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import type React from "react";

type JustUsedInfo = {
  event: string;
  seat: string;
  holder: string;
  when: string; // ISO date string
};

type AlreadyUsedInfo = {
  event: string;
  seat: string;
  holder: string;
  usedAt: string; // ISO date string
};

type ScanResult =
  | { ok: true; status: "JUST_USED"; info: JustUsedInfo }
  | { ok: true; status: "ALREADY_USED"; info: AlreadyUsedInfo }
  | { ok: false; error?: string; status?: string };

export default function AdminScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // Inicializa sin efecto para evitar "set-state-in-effect"
  const [cameraSupported] = useState<boolean>(
    () => !!navigator.mediaDevices?.getUserMedia
  );

  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualQR, setManualQR] = useState<string>("");
  const [reading, setReading] = useState<boolean>(false);

  async function startCamera() {
    if (!cameraSupported || !videoRef.current) return;
    setLastResult(null);
    setReading(true);

    try {
      const codeReader = new BrowserQRCodeReader();
      const controls = await codeReader.decodeFromVideoDevice(
        undefined, // cámara por defecto
        videoRef.current,
        async (result, _err, _controls) => {
          if (_controls && !controlsRef.current) controlsRef.current = _controls;
          if (result) {
            await validateOnServer(result.getText());
          }
          // errores por frame se ignoran
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      console.error("Cam error:", e);
      setReading(false);
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setReading(false);
  }

  async function validateOnServer(qr: string) {
    try {
      const res = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr }),
      });
      const data = (await res.json()) as ScanResult;
      setLastResult(data);
    } catch {
      setLastResult({ ok: false, error: "Error de red" });
    }
  }

  // “Cámara virtual”: pegar texto del QR
  async function submitManual() {
    if (!manualQR.trim()) return;
    await validateOnServer(manualQR.trim());
  }

  // Decodificar una imagen subida (PNG/JPG) como “cámara virtual”
  async function decodeFromImage(file: File) {
    try {
      const url = URL.createObjectURL(file);
      const codeReader = new BrowserQRCodeReader();
      const res = await codeReader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      await validateOnServer(res.getText());
    } catch {
      setLastResult({ ok: false, error: "No se pudo leer un QR de esa imagen." });
    }
  }

  return (
    <div className="p-4 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-3">Escaneo de Tickets</h1>

      {/* Bloque cámara */}
      <div className="border rounded p-3 mb-4">
        <h2 className="font-semibold mb-2">Cámara</h2>
        {!cameraSupported && (
          <p className="text-sm text-red-600">
            Este dispositivo no soporta cámara en el navegador.
          </p>
        )}
        <div className="flex items-center gap-3 mb-3">
          <button
            className="border rounded px-3 py-1"
            onClick={reading ? stopCamera : startCamera}
            disabled={!cameraSupported}
          >
            {reading ? "Detener cámara" : "Iniciar cámara"}
          </button>
        </div>
        <video
          ref={videoRef}
          className="w-full max-w-md border rounded"
          muted
          playsInline
        />
      </div>

      {/* Bloque cámara virtual */}
      <div className="border rounded p-3 mb-4">
        <h2 className="font-semibold mb-2">Cámara virtual</h2>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="Pega aquí el texto del QR (TICKET:...)"
              value={manualQR}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setManualQR(e.target.value)
              }
            />
            <button className="border rounded px-3 py-1" onClick={submitManual}>
              Validar
            </button>
          </div>
          <div className="text-sm text-gray-600">o sube una imagen con el QR:</div>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) void decodeFromImage(file);
            }}
          />
        </div>
      </div>

      {/* Resultado */}
      {lastResult && (
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Resultado</h2>
          {lastResult.ok ? (
            lastResult.status === "JUST_USED" ? (
              <div className="text-green-700">
                ✅ Ticket validado y marcado como usado.
                <br />
                <b>Evento:</b> {lastResult.info.event}
                <br />
                <b>Asiento:</b> {lastResult.info.seat}
                <br />
                <b>Titular:</b> {lastResult.info.holder}
                <br />
                <b>Hora:</b>{" "}
                {new Date(lastResult.info.when).toLocaleString()}
              </div>
            ) : lastResult.status === "ALREADY_USED" ? (
              <div className="text-yellow-700">
                ⚠️ Ticket ya había sido usado.
                <br />
                <b>Evento:</b> {lastResult.info.event}
                <br />
                <b>Asiento:</b> {lastResult.info.seat}
                <br />
                <b>Titular:</b> {lastResult.info.holder}
                <br />
                <b>Usado:</b>{" "}
                {new Date(lastResult.info.usedAt).toLocaleString()}
              </div>
            ) : (
              <div>Respuesta: {JSON.stringify(lastResult)}</div>
            )
          ) : (
            <div className="text-red-700">
              ❌ {lastResult.error || lastResult.status || "No válido"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
