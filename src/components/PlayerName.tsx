import { Text, type StyleProp, type TextStyle } from "react-native";

export interface PlayerNameProps {
  name: string;
  style?: StyleProp<TextStyle>;
}

export function PlayerName({ name, style }: PlayerNameProps) {
  return (
    <Text accessibilityLabel={name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={style}>
      {name}
    </Text>
  );
}
