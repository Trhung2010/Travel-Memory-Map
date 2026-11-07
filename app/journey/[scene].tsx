import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import JourneySceneScreen from '../../src/journey/JourneySceneScreen';
import {isJourneyScene} from '../../src/journey/scenes';

export default function JourneyRoute(){
  const {scene,id,capture}=useLocalSearchParams<{scene:string;id?:string;capture?:string}>();
  return <JourneySceneScreen scene={typeof scene==='string'&&isJourneyScene(scene)?scene:'home'}
    id={typeof id==='string'?id:undefined} capture={capture==='video'?'video':'photo'}/>;
}

