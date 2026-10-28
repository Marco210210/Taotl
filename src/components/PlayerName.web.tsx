import type { ComponentRef } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { PlayerNameProps } from "./PlayerName";

// React Native Web non implementa adjustsFontSizeToFit: misuriamo il testo
// con il font effettivo e riduciamo solo i nomi che supererebbero due righe.
export function PlayerName({ name, style }: PlayerNameProps) {
  const ref = useRef<ComponentRef<typeof Text>>(null);
  const [width, setWidth] = useState(0);
  const baseSize = StyleSheet.flatten(style)?.fontSize ?? 14.5;
  const [fontSize, setFontSize] = useState(baseSize);

  useLayoutEffect(() => {
    const element = ref.current as unknown as HTMLElement | null;
    if (!element || !width) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const computed = getComputedStyle(element);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      const fits = (size: number) => {
        context.font = `${computed.fontWeight} ${size}px ${computed.fontFamily}`;
        let line = "";
        let lines = 1;
        for (const word of name.trim().split(/\s+/)) {
          if (context.measureText(word).width > width) return false;
          const next = line ? `${line} ${word}` : word;
          if (line && context.measureText(next).width > width) {
            lines++;
            line = word;
          } else line = next;
        }
        return lines <= 2;
      };
      let size = baseSize;
      const minimum = baseSize * 0.7;
      while (size > minimum && !fits(size)) size = Math.max(minimum, size - 0.25);
      setFontSize(size);
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => { active = false; };
  }, [name, width, baseSize, style]);

  return (
    <Text ref={ref} accessibilityLabel={name} numberOfLines={2}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[style, { fontSize }]}>
      {name}
    </Text>
  );
}
