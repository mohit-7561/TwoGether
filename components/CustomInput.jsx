import React from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';
import { colors } from '../constants/colors';

const CustomInput = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  icon = null,
  ...props
}) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        {...props}
      />
      {icon && <View style={styles.iconContainer}>{icon}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textDark,
    minHeight: 50,
  },
  iconContainer: {
    position: 'absolute',
    right: 16,
    top: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CustomInput;

