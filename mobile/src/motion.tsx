// Moving pieces: the road with a driving car, the score ring that fills up, and sections that slide in.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { T } from './theme';

const DASH = 26, GAP = 22, PERIOD = DASH + GAP;

/** A road whose lane lines move under a bobbing car. Faster driving moves the lines faster. */
export function DrivingRoad({ kmh }: { kmh: number }) {
  const lines = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  // Round the speed so the loop only restarts when the pace visibly changes.
  const pace = Math.max(10, Math.round(kmh / 10) * 10);

  useEffect(() => {
    lines.setValue(0);
    const loop = Animated.loop(Animated.timing(lines, { toValue: 1, duration: 9000 / pace, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [lines, pace]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -3, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const shift = lines.interpolate({ inputRange: [0, 1], outputRange: [0, -PERIOD] });
  return (
    <View style={road.box}>
      <LinearGradient colors={['#2A2F3A', '#16191F']} style={road.asphalt}>
        <Animated.View style={[road.lane, { transform: [{ translateX: shift }] }]}>
          {Array.from({ length: 14 }, (_, i) => <View key={i} style={road.dash} />)}
        </Animated.View>
        <Animated.View style={[road.car, { transform: [{ translateY: bob }] }]}>
          <View style={road.shadow} />
          <MaterialCommunityIcons name="car-side" size={64} color={T.ring.good[0]} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const road = StyleSheet.create({
  box: { borderRadius: 28, overflow: 'hidden', ...T.cardShadow },
  asphalt: { height: 120, justifyContent: 'flex-end' },
  lane: { position: 'absolute', top: 88, left: 0, flexDirection: 'row', gap: GAP },
  dash: { width: DASH, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  car: { position: 'absolute', left: '50%', marginLeft: -32, top: 22, alignItems: 'center' },
  shadow: { position: 'absolute', bottom: 6, width: 52, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
});

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
  number: { color: T.text, fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -3 },
  word: { fontSize: 15, fontWeight: '800', marginTop: -4 },
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
