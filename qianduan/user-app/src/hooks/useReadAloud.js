import { useCallback, useEffect, useRef, useState } from "react";
import { speechApi } from "../api/client.js";

function toSpeechText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 课堂朗读：优先百炼云语音，失败自动降级浏览器朗读。 */
export function useReadAloud() {
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const [speechState, setSpeechState] = useState("");

  const stopSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setSpeechState("");
  }, []);

  const browserReadAloud = useCallback((text, cloudError) => {
    if (!("speechSynthesis" in window)) {
      setSpeechState("语音暂时不可用，请阅读屏幕文字");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeechState("");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeechState(cloudError
      ? `百炼云语音未连接（${cloudError}），已切换浏览器朗读`
      : "已切换浏览器朗读");
  }, []);

  const readAloud = useCallback(async (text) => {
    const speechText = toSpeechText(text);
    if (!speechText) return;
    stopSpeech();
    setSpeechState("正在准备百炼云语音…");
    try {
      const audioResult = await speechApi.synthesize(speechText);
      const url = URL.createObjectURL(audioResult.blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = () => setSpeechState("百炼云语音正在朗读");
      audio.onended = () => stopSpeech();
      audio.onerror = () => browserReadAloud(speechText, "云端音频播放失败");
      await audio.play();
    } catch (requestError) {
      browserReadAloud(speechText, requestError?.message);
    }
  }, [browserReadAloud, stopSpeech]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  return { speechState, readAloud, stopSpeech };
}
