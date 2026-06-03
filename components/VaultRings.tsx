import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop, Circle, ClipPath } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, withDelay } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const polar = (cx: number, cy: number, r: number, deg: number) => {
  'worklet';
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) => {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
};

const START_DEG = 225;
const SWEEP_DEG = 270;

const Ring = React.memo(({ cx, cy, r, sw, progress, trackColor, gradId, color, clipId, delay = 0 }: {
  cx: number; cy: number; r: number; sw: number; progress: number;
  trackColor: string; gradId: string; color: string; clipId: string; delay?: number;
}) => {
  const anim = useSharedValue(0);
  React.useEffect(() => {
    anim.value = withDelay(delay, withTiming(progress, { duration: 1000 }));
  }, [progress, delay]);

  const trackArc = arcPath(cx, cy, r, START_DEG, SWEEP_DEG);
  const progressArc = arcPath(cx, cy, r, START_DEG, SWEEP_DEG);
  const arcLen = (2 * Math.PI * r * SWEEP_DEG) / 360;
  const fullCirc = 2 * Math.PI * r;

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - anim.value),
  }));
  const capProps = useAnimatedProps(() => {
    const endDeg = START_DEG + anim.value * SWEEP_DEG;
    const p = polar(cx, cy, r, endDeg);
    return { cx: p.x, cy: p.y, opacity: anim.value > 0.05 ? 1 : 0 };
  });
  const clipAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - anim.value),
  }));

  const { folkPath } = useMemo(() => {
    let f = "";
    const unitPx = 8;
    const stepDeg = (unitPx / (2 * Math.PI * r)) * 360;
    const count = Math.floor(SWEEP_DEG / stepDeg);

    for (let i = 0; i <= count; i++) {
      const angleDeg = START_DEG + i * stepDeg;
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      const tangRad = rad + Math.PI / 2;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const ct = Math.cos(tangRad), st = Math.sin(tangRad);
      const cn = Math.cos(rad),     sn = Math.sin(rad);

      const diamond = (hw: number, hh: number) => {
        const p1x = x + hw * ct, p1y = y + hw * st;
        const p2x = x + hh * cn, p2y = y + hh * sn;
        const p3x = x - hw * ct, p3y = y - hw * st;
        const p4x = x - hh * cn, p4y = y - hh * sn;
        return `M${p1x},${p1y} L${p2x},${p2y} L${p3x},${p3y} L${p4x},${p4y} Z `;
      };

      const isLarge = i % 3 !== 1;
      if (isLarge) {
        const hw = sw * 0.38, hh = sw * 0.44;
        f += diamond(hw, hh);
        f += diamond(hw * 0.55, hh * 0.55);
        const tip = sw * 0.12;
        f += `M${x+hh*cn},${y+hh*sn} l${tip*cn},${tip*sn} `;
        f += `M${x-hh*cn},${y-hh*sn} l${-tip*cn},${tip*sn} `;
      } else {
        const xs = sw * 0.22;
        f += `M${x-xs*ct-xs*cn},${y-xs*st-xs*sn} L${x+xs*ct+xs*cn},${y+xs*st+xs*sn} `
           + `M${x+xs*ct-xs*cn},${y+xs*st-xs*sn} L${x-xs*ct+xs*cn},${y-xs*st-xs*sn} `;
        f += diamond(sw * 0.08, sw * 0.08);
      }
    }
    return { folkPath: f };
  }, [cx, cy, r, sw]);

  return (
    <G>
      <Path d={trackArc} stroke={trackColor} strokeWidth={sw} fill="none" strokeLinecap="round" />
      <AnimatedPath d={progressArc} stroke={`url(#${gradId})`} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${arcLen} ${fullCirc}`} animatedProps={progressProps} />
      <Defs>
        <ClipPath id={clipId}>
          <AnimatedPath
            d={progressArc}
            stroke="white"
            strokeWidth={sw + 2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${fullCirc}`}
            animatedProps={clipAnimProps}
          />
        </ClipPath>
      </Defs>
      <Path d={folkPath} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.22)" strokeWidth={0.3} clipPath={`url(#${clipId})`} />
      <AnimatedCircle r={sw / 2 - 1.5} fill="#FFFFFF" animatedProps={capProps} />
    </G>
  );
});

const CenterMedallion = React.memo(({ cx, cy }: { cx: number; cy: number }) => {
  const d = useMemo(() => {
    let path = "";
    const s = (x: number, y: number, sz: number) =>
      `M${x},${y} l${sz},${sz} M${x+sz},${y} l-${sz},${sz} `;

    // Bloom rosette
    const center3x3 = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[0,0]];
    center3x3.forEach(([dx, dy]) => {
      if (dx === undefined || dy === undefined) return;
      path += s(cx + dx * 1.4 - 0.9, cy + dy * 1.4 - 0.9, 1.8);
    });

    // Inner Solar Cross
    for (let p = 0; p < 8; p++) {
      const ang = (p * 45 * Math.PI) / 180;
      const perp = ang + Math.PI / 2;
      const stem = { x: cx + 4 * Math.cos(ang), y: cy + 4 * Math.sin(ang) };
      path += s(stem.x - 0.9, stem.y - 0.9, 1.8);
      const tip = { x: cx + 7 * Math.cos(ang), y: cy + 7 * Math.sin(ang) };
      path += s(tip.x - 1.0, tip.y - 1.0, 2.0);
      [1, -1].forEach(side => {
        const wing = {
          x: cx + 5.5 * Math.cos(ang) + side * 2.0 * Math.cos(perp),
          y: cy + 5.5 * Math.sin(ang) + side * 2.0 * Math.sin(perp)
        };
        path += s(wing.x - 0.8, wing.y - 0.8, 1.6);
      });
      const base = { x: cx + 5 * Math.cos(ang), y: cy + 5 * Math.sin(ang) };
      path += s(base.x - 0.6, base.y - 0.6, 1.2);
    }

    // Brâu belt ring
    for (let i = 0; i < 16; i++) {
      const ang = (i * 22.5 * Math.PI) / 180;
      const perp = ang + Math.PI / 2;
      const r = 9;
      const main = { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
      path += s(main.x - 0.9, main.y - 0.9, 1.8);
      [0.9, -0.9].forEach(off => {
        const flank = { x: main.x + off * Math.cos(perp), y: main.y + off * Math.sin(perp) };
        path += s(flank.x - 0.5, flank.y - 0.5, 1.0);
      });
    }

    // Outer Petals
    for (let p = 0; p < 8; p++) {
      const ang = (p * 45 * Math.PI) / 180;
      const perp = ang + Math.PI / 2;
      [[11, 0],[12.5, 0],[13.5, 0],[12, 1.8],[12, -1.8]].forEach(([r, off]) => {
        if (r === undefined || off === undefined) return;
        const x = cx + r * Math.cos(ang) + off * Math.cos(perp);
        const y = cy + r * Math.sin(ang) + off * Math.sin(perp);
        const sz = off === 0 ? 1.8 : 1.2;
        path += s(x - sz/2, y - sz/2, sz);
      });
    }

    // Inter-petal diamonds
    for (let i = 0; i < 16; i++) {
      const ang = ((i * 22.5 + 22.5) * Math.PI) / 180;
      const r = i % 2 === 0 ? 10 : 11;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      path += s(x - 0.7, y - 0.7, 1.4);
      path += s(x + 0.8, y - 0.3, 0.9);
      path += s(x - 0.3, y + 0.8, 0.9);
    }

    // Braid ring
    for (let i = 0; i < 32; i++) {
      const ang = (i * 11.25 * Math.PI) / 180;
      const r = 15 + (i % 2 === 0 ? 0.5 : -0.5);
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      const sz = i % 4 === 0 ? 1.4 : 0.9;
      path += s(x - sz/2, y - sz/2, sz);
    }

    // Outer Crown
    for (let i = 0; i < 24; i++) {
      const ang = (i * 15 * Math.PI) / 180;
      const r = i % 3 === 0 ? 20 : i % 3 === 1 ? 18.5 : 19.2;
      const sz = i % 3 === 0 ? 1.6 : 1.0;
      path += s(cx + r * Math.cos(ang) - sz/2, cy + r * Math.sin(ang) - sz/2, sz);
    }

    return path;
  }, [cx, cy]);

  return <Path d={d} stroke="#FFFFFF" strokeWidth="0.55" opacity={0.06} fill="none" />;
});

export const VaultRings = React.memo<{
  passwordsCount: number;
  seedsCount: number;
  notesCount: number;
}>(function VaultRings({ passwordsCount, seedsCount, notesCount }) {
  const SIZE = 200, CX = SIZE / 2, CY = SIZE / 2;
  const SW = 14, GAP = 8, R1 = 82, R2 = R1 - SW - GAP, R3 = R2 - SW - GAP;
  const clipY = Math.round(CY + R1 * Math.sin((135 * Math.PI) / 180) + SW / 2 + 4), vbH = clipY;

  const passwordsProgress = passwordsCount > 0 ? Math.min(passwordsCount / 10, 1) : 0.05;
  const seedsProgress = seedsCount > 0 ? Math.min(seedsCount / 5, 1) : 0.05;
  const notesProgress = notesCount > 0 ? Math.min(notesCount / 10, 1) : 0.05;

  return (
    <View style={styles.card}>
      <View style={styles.ringsContainer}>
        <Svg width={SIZE} height={vbH} viewBox={`0 0 ${SIZE} ${vbH}`} style={{ overflow: 'hidden' }}>
          <Defs>
            <LinearGradient id="gOuter" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#FFFFFF" /><Stop offset="100%" stopColor="#A1A1AA" />
            </LinearGradient>
            <LinearGradient id="gMiddle" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#A1A1AA" /><Stop offset="100%" stopColor="#52525B" />
            </LinearGradient>
            <LinearGradient id="gInner" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#52525B" /><Stop offset="100%" stopColor="#27272A" />
            </LinearGradient>
          </Defs>
          <CenterMedallion cx={CX} cy={CY} />
          <Ring cx={CX} cy={CY} r={R1} sw={SW} progress={passwordsProgress} trackColor="rgba(255,255,255,0.02)" gradId="gOuter" color="#FFFFFF" clipId="vc1" delay={0} />
          <Ring cx={CX} cy={CY} r={R2} sw={SW} progress={seedsProgress} trackColor="rgba(255,255,255,0.02)" gradId="gMiddle" color="#A1A1AA" clipId="vc2" delay={200} />
          <Ring cx={CX} cy={CY} r={R3} sw={SW} progress={notesProgress} trackColor="rgba(255,255,255,0.02)" gradId="gInner" color="#52525B" clipId="vc3" delay={400} />
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.item}>
          <Text style={[styles.label, { color: '#8E8E93' }]}>Passwords</Text>
          <Text style={[styles.big, { color: '#FFFFFF' }]}>{passwordsCount}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.item}>
          <Text style={[styles.label, { color: '#8E8E93' }]}>Seeds</Text>
          <Text style={[styles.big, { color: '#FFFFFF' }]}>{seedsCount}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.item}>
          <Text style={[styles.label, { color: '#8E8E93' }]}>Notes</Text>
          <Text style={[styles.big, { color: '#FFFFFF' }]}>{notesCount}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0D0D12',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 24,
  },
  ringsContainer: {
    width: 200,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  legend: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  sep: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginVertical: 4
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4
  },
  big: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
