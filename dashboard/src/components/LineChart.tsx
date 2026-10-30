import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../lib/theme';
import { Reading } from '../lib/types';

type Props = { title: string; unit: string; data: Reading[]; min: number; max: number };

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

export default function LineChart({ title, unit, data, min, max }: Props) {
  const [w, setW] = useState(0);
  const h = 170;
  const p = { l: 38, r: 8, t: 10, b: 22 };

  const vals = data.map((d) => d.value);
  const lo = Math.min(min, ...vals);
  const hi = Math.max(max, ...vals);
  const span = hi - lo || 1;
  const yLo = lo - span * 0.12;
  const yHi = hi + span * 0.12;

  const x = (i: number) =>
    p.l + (data.length <= 1 ? 0 : (i * (w - p.l - p.r)) / (data.length - 1));
  const y = (v: number) => p.t + (1 - (v - yLo) / (yHi - yLo)) * (h - p.t - p.b);

  const path = data
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ');

  const last = data[data.length - 1];

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.last}>{last ? `${last.value.toFixed(1)} ${unit}` : '--'}</Text>
      </View>

      {w > 0 && data.length > 0 ? (
        <Svg width={w} height={h}>
          {/* Limites (triggers) */}
          {[max, min].map((v, i) => (
            <React.Fragment key={i}>
              <Line
                x1={p.l}
                x2={w - p.r}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.muted}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText x={p.l - 6} y={y(v) + 4} fill={colors.muted} fontSize="10" textAnchor="end">
                {v}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Linha dos dados */}
          <Path d={path} stroke={colors.text} strokeWidth={2} fill="none" />
          {data.length <= 30 &&
            data.map((d, i) => (
              <Circle key={i} cx={x(i)} cy={y(d.value)} r={2.5} fill={colors.text} />
            ))}
          {last && <Circle cx={x(data.length - 1)} cy={y(last.value)} r={5} fill={colors.text} />}

          {/* Horários inicial e final */}
          <SvgText x={p.l} y={h - 6} fill={colors.muted} fontSize="10" textAnchor="start">
            {fmtTime(data[0].time)}
          </SvgText>
          <SvgText x={w - p.r} y={h - 6} fill={colors.muted} fontSize="10" textAnchor="end">
            {fmtTime(last.time)}
          </SvgText>
        </Svg>
      ) : (
        <View style={[s.empty, { height: h }]}>
          <Text style={s.emptyText}>Sem dados históricos</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  title: { color: colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  last: { color: colors.text, fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 13 },
});