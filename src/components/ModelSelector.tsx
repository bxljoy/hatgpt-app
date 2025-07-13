import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ModelType } from '@/types';

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelSelect: (model: ModelType) => void;
  style?: any;
}

const modelInfo = {
  'gpt-4o': {
    name: 'GPT-4o',
    description: 'OpenAI\'s most capable model',
    color: '#10A37F',
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Google\'s fastest multimodal model',
    color: '#4285F4',
  },
} as const;

export function ModelSelector({ selectedModel, onModelSelect, style }: ModelSelectorProps) {
  return (
    <View style={[styles.container, style]}>
      {Object.entries(modelInfo).map(([modelKey, info]) => {
        const model = modelKey as ModelType;
        const isSelected = selectedModel === model;
        
        return (
          <TouchableOpacity
            key={model}
            style={[
              styles.modelOption,
              isSelected && { ...styles.selectedModel, borderColor: info.color },
            ]}
            onPress={() => onModelSelect(model)}
            activeOpacity={0.7}
          >
            <View style={styles.modelInfo}>
              <Text style={[
                styles.modelName,
                isSelected && { color: info.color }
              ]}>
                {info.name}
              </Text>
              <Text style={styles.modelDescription}>
                {info.description}
              </Text>
            </View>
            <View style={[
              styles.radioButton,
              isSelected && { ...styles.radioButtonSelected, backgroundColor: info.color }
            ]}>
              {isSelected && <View style={styles.radioButtonInner} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  selectedModel: {
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  modelDescription: {
    fontSize: 14,
    color: '#666666',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#FFFFFF',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});