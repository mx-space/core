import { ChatOpenAI } from '@langchain/openai'
import { JsonOutputFunctionsParser } from 'langchain/output_parsers'
import { HumanMessage } from '@langchain/core/messages'

// // Invoke the runnable with an input
// const result = await runnable.invoke([
//   new HumanMessage(
//     '还在在校期间，有非常多的时间去探索方向，学习实用的感兴趣的东西，而我在那时学了 Vue，靠着这个得到了第一份实习的工作，然后在职期间学习了 React 和 Next.js。而我到现在技术水平一直停滞在那会，即便是过去了这么久，我依然只会这些技术栈。我使用过很多框架和 SaaS 服务，但这些并不是什么优势。我想到在我校招面试的时候，面试官总会说你虽然广度比较可以，但是没有深度。过去了两年，这个评价依然适用于我，即便是使用了 Next.js 作为主要的开发框架四年，虽然经历了历代的版本更新，但是在底层原理上依旧是全然不解，单单停留在应用层。',
//   ),
// ])

// console.log({ result })
import OpenAI from 'openai'

// Instantiate the parser
const parser = new JsonOutputFunctionsParser()

// Define the function schema
const extractionFunctionSchema = {
  name: 'extractor',
  description: 'Extracts fields from the input.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'The following text a title in the same language as the text',
      },
    },
    required: ['title'],
  },
}

// Instantiate the ChatOpenAI class
const model = new ChatOpenAI({
  model: 'gpt-4',
  openAIApiKey: 'sk-ZhPxfqfwMd8z5WW5EbC42dBdB3Fb433f92173c1f52A33d11',
  configuration: {
    baseURL: 'https://burn.hair/v1',
    apiKey: 'sk-ZhPxfqfwMd8z5WW5EbC42dBdB3Fb433f92173c1f52A33d11',
  },
})

// Create a new runnable, bind the function to the model, and pipe the output through the parser
const runnable = model
  .bind({
    functions: [extractionFunctionSchema],
    function_call: { name: 'extractor' },
  })
  .pipe(parser)

console.log(
  await runnable.invoke([
    '还在在校期间，有非常多的时间去探索方向，学习实用的感兴趣的东西，而我在那时学了 Vue，靠着这个得到了第一份实习的工作，然后在职期间学习了 React 和 Next.js。而我到现在技术水平一直停滞在那会，即便是过去了这么久，我依然只会这些技术栈。我使用过很多框架和 SaaS 服务，但这些并不是什么优势。我想到在我校招面试的时候，面试官总会说你虽然广度比较可以，但是没有深度。过去了两年，这个评价依然适用于我，即便是使用了 Next.js 作为主要的开发框架四年，虽然经历了历代的版本更新，但是在底层原理上依旧是全然不解，单单停留在应用层。',
  ]),
)
