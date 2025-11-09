import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const logoSource = require('../Logo/logo.png');

const Logo = ({ size = 'large' }) => {
  const width = size === 'large' ? 160 : 120;

  return (
    <View style={styles.container}>
      <Image source={logoSource} style={[styles.image, { width }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    height: undefined,
    aspectRatio: 1,
    resizeMode: 'contain',
  },
});

export default Logo;

