const fs = require('fs');

if (!fs.existsSync('d:/Zero Vault full/zero-vault/components/ui')) {
  fs.mkdirSync('d:/Zero Vault full/zero-vault/components/ui', { recursive: true });
}

const svgPath = 'd:/Zero Vault full/bird-app-icon.svg';
let svgContent = fs.readFileSync(svgPath, 'utf8');

// Use split and join to avoid regex escaping issues in JS strings written via JSON
svgContent = svgContent.split('<svg').join('<Svg');
svgContent = svgContent.split('</svg>').join('</Svg>');
svgContent = svgContent.split('<rect').join('<Rect');
svgContent = svgContent.split('<g').join('<G');
svgContent = svgContent.split('</g>').join('</G>');
svgContent = svgContent.split('<defs').join('<Defs');
svgContent = svgContent.split('</defs>').join('</Defs>');
svgContent = svgContent.split('<clipPath').join('<ClipPath');
svgContent = svgContent.split('</clipPath>').join('</ClipPath>');
svgContent = svgContent.split('<path').join('<Path');

svgContent = svgContent.split('clip-path=').join('clipPath=');
svgContent = svgContent.split('stroke-width=').join('strokeWidth=');

// regex for xmlns
svgContent = svgContent.replace(/xmlns="[^"]*"/g, '');

// regex for rect fill #f6f5f2
svgContent = svgContent.split('<Rect x="0" y="0" width="1024" height="1024" rx="225" fill="#f6f5f2"/>').join('');

const headSvg = `
  <G>
    <!-- Geometric Head & Beak -->
    <Path d="M 660,330 L 720,240 L 740,280 L 780,260 L 750,310 L 730,340 Z" fill="#0a0a0a" />
    <Path d="M 720,240 L 740,280 L 780,260 Z" fill="#1a1a1a" />
    
    <!-- Sentinel Eye -->
    <Circle cx="720" cy="290" r="6" fill="#FF0033" />
    <Circle cx="720" cy="290" r="12" fill="rgba(255, 0, 51, 0.3)" />
    <Circle cx="720" cy="290" r="3" fill="#FFFFFF" />
  </G>
`;

svgContent = svgContent.split('</Svg>').join(headSvg + '\\n</Svg>');
svgContent = svgContent.split('<Svg ').join('<Svg width={size} height={size} ');

const tsxContent = `import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, G, Defs, ClipPath, Rect, Circle } from 'react-native-svg';

interface Props {
  size?: number;
}

export function TurturicaMascot({ size = 100 }: Props) {
  return (
    <View style={styles.container}>
      ${svgContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
`;

fs.writeFileSync('d:/Zero Vault full/zero-vault/components/ui/TurturicaMascot.tsx', tsxContent);
console.log('Successfully created TurturicaMascot.tsx');
