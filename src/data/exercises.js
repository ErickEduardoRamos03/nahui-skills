export const readingSets=[
{id:'r-library',title:'Libraries after the digital shift',text:`When online information became widely available, some people predicted that public libraries would disappear. Instead, many libraries changed their services while preserving quiet spaces for reading. One community library converted an unused storage room into a digital learning area. Visitors can prepare résumés, attend online-safety workshops and use equipment that many households cannot afford. Printed books still occupy most of the building. A visitor survey found that most respondents valued both printed material and digital support. However, the survey did not ask whether residents would accept higher taxes to finance expansion. The library can therefore conclude that its services are appreciated, but it cannot assume that every funding proposal will receive support.`,questions:[
{prompt:'What is the main purpose of the text?',options:['To demand higher taxes','To explain how a library adapted','To show that printed books are obsolete'],answer:1,tag:'main-idea',why:'The passage describes adaptation, benefits and limits. Taxes are a detail, not the thesis.'},
{prompt:'The digital area replaced a reading room.',options:['True','False','Not Given'],answer:1,tag:'detail',why:'It replaced an unused storage room.'},
{prompt:'Every respondent preferred digital resources.',options:['True','False','Not Given'],answer:1,tag:'quantifiers',why:'The text says most valued both formats. Most does not mean every.'},
{prompt:'How much did the conversion cost?',options:['Less than expected','More than expected','Not Given'],answer:2,tag:'not-given',why:'No cost is stated.'}]},
{id:'r-study',title:'Shorter study sessions',text:`A university learning centre tested a voluntary programme that encouraged students to replace long, irregular study sessions with shorter daily reviews. Participants used retrieval practice, checked errors and planned the next session before stopping. After six weeks, most participants reported that starting work felt easier. Their examination scores improved slightly, although the programme did not compare them with a randomly selected control group. The researchers therefore warned that the results could not prove the routine alone caused the improvement. Students who volunteered may already have been more motivated than average. Nevertheless, the project suggests that a manageable routine can reduce procrastination and make gaps in understanding visible earlier.`,questions:[
{prompt:'What limitation do the researchers identify?',options:['The programme was compulsory','There was no random control group','Scores became lower'],answer:1,tag:'evidence',why:'Without a random control group, causation cannot be established securely.'},
{prompt:'The project proves short sessions always improve scores.',options:['True','False','Not Given'],answer:1,tag:'quantifiers',why:'The text explicitly says it cannot prove causation, and always is too absolute.'},
{prompt:'What benefit was reported by most participants?',options:['Starting work felt easier','They studied fewer subjects','All procrastination disappeared'],answer:0,tag:'detail',why:'That benefit is stated directly.'}]}
]

export const listeningTemplates=[
{id:'l-workshop',accent:'en-US',template:'Good morning. The career workshop was originally scheduled for {oldRoom}, but it will now take place in {newRoom}. Registration begins at {register}, although the first presentation starts at {start}. You may show your confirmation on your phone, so a printed copy is not required.',variables:{oldRoom:['Room fourteen','Room twenty'],newRoom:['the main library conference room','the science building auditorium'],register:['nine fifteen','eight forty-five'],start:['ten o’clock','nine thirty']},questions:[
{prompt:'Where will the workshop take place?',field:'newRoom',optionsFrom:['oldRoom','newRoom'],tag:'correction'},
{prompt:'When does registration begin?',field:'register',optionsFrom:['register','start'],tag:'detail'},
{prompt:'Is a printed confirmation required?',fixedOptions:['Yes','No','Not stated'],answer:1,tag:'modality'}]},
{id:'l-train',accent:'en-GB',template:'Passengers for the {destination} service should note that the train will depart from platform {newPlatform}, not platform {oldPlatform}. The service is delayed by approximately {delay}. Customers with first-class tickets may use the lounge near the main entrance.',variables:{destination:['Bristol','York','Manchester'],newPlatform:['six','nine','twelve'],oldPlatform:['four','seven','ten'],delay:['fifteen minutes','twenty minutes','half an hour']},questions:[
{prompt:'Which platform should passengers use?',field:'newPlatform',optionsFrom:['oldPlatform','newPlatform'],tag:'correction'},
{prompt:'How long is the delay?',field:'delay',optionsFrom:['delay'],tag:'detail'},
{prompt:'Who may use the lounge?',fixedOptions:['All passengers','First-class ticket holders','Station staff only'],answer:1,tag:'detail'}]}
]

export const writingPrompts=[
{genre:'Formal email',prompt:'Your course certificate contains incorrect information. Write to the coordinator, explain the problem, give the correct information and request a solution.',points:['problem','correct information','request'],formal:true},
{genre:'Opinion article',prompt:'Should university classes remain partly online? Give your opinion, provide examples and address one opposing view.',points:['opinion','example','opposing view'],formal:false},
{genre:'Short report',prompt:'Your school wants to improve its study areas. Describe the current situation, identify two problems and recommend improvements.',points:['situation','two problems','recommendations'],formal:true}
]

export const speakingQuestions=[
{category:'personal',prompt:'Could you introduce yourself and tell me about your studies?',followups:['What part of your studies interests you most?','What would you like to do after graduating?']},
{category:'experience',prompt:'Tell me about an achievement that required considerable effort.',followups:['What difficulty did you face?','What did you learn from the experience?']},
{category:'opinion',prompt:'Are online classes as effective as face-to-face classes?',followups:['What is the strongest opposing argument?','Can you give me a specific example?']},
{category:'hypothetical',prompt:'If you could improve one aspect of education in your community, what would you change?',followups:['Who would benefit most?','What obstacle might prevent that change?']},
{category:'future',prompt:'What will you be doing this time next year?',followups:['What steps will you take to achieve that?','How might your plan change?']}
]
