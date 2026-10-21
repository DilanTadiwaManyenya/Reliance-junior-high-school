const validNumber = (value,max) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=max
export function performanceComment(values,{developmental=false}={}) {
 const recorded=values.filter(value=>validNumber(value,developmental?5:100)).map(Number).filter(value=>!developmental||value>=1)
 if(!recorded.length)return 'Assessment is not yet complete. A performance comment will appear when results are recorded.'
 const average=recorded.reduce((sum,value)=>sum+value,0)/recorded.length
 if(developmental) {
  if(average>=4)return 'Very good developmental progress across the assessed areas. Continue to encourage curiosity, play and independence.'
  if(average>=3)return 'Good developmental progress across the assessed areas. Continued practice and encouragement will strengthen confidence.'
  if(average>=2)return 'Development is progressing. Regular guided play and individual encouragement will help strengthen the assessed skills.'
  return 'Additional individual support is needed in the assessed developmental areas. Work closely with the teacher on small, achievable steps.'
 }
 if(average>=80)return 'Excellent overall performance in the recorded assessments. Maintain this effort and continue to build on these strengths.'
 if(average>=65)return 'Good overall performance in the recorded assessments. Consistent revision will help strengthen results further.'
 if(average>=50)return 'Satisfactory overall performance in the recorded assessments. More regular practice is needed in weaker areas.'
 return 'The recorded assessments show that additional support and regular practice are needed. Work with the teacher on the areas requiring improvement.'
}
