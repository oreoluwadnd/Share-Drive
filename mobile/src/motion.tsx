// Moving pieces: the score ring that fills up, and sections that slide in.

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { FONT } from './brand';
import { T } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that fills up to the score while the number counts up. */
export function ScoreRing({ value, colors, word }: { value: number; colors: readonly [string, string]; word: string }) {
  const size = 220, stroke = 18;
  const r = (size - stroke) / 2, around = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(progress, { toValue: value, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => progress.removeListener(id);
  }, [progress, value]);

  const offset = progress.interpolate({ inputRange: [0, 100], outputRange: [around, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={T.track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} stroke="url(#ring)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${around} ${around}`} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={ring.number}>{shown}</Text>
      <Text style={[ring.word, { color: colors[0] }]}>{word}</Text>
    </View>
  );
}

const ring = StyleSheet.create({
  number: { color: T.text, fontSize: 72, fontFamily: FONT.head, fontVariant: ['tabular-nums'], letterSpacing: -3 },
  word: { fontSize: 15, fontFamily: FONT.head, marginTop: -4 },
});

/** Fades and slides its content up, after `delay` milliseconds. */
export function SlideIn({ delay, children }: { delay: number; children: ReactNode }) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [appear, delay]);
  const rise = appear.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return <Animated.View style={{ opacity: appear, transform: [{ translateY: rise }] }}>{children}</Animated.View>;
}
