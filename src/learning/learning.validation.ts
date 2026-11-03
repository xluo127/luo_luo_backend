import { BadRequestException } from '@nestjs/common';

export function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('请求内容必须是对象');
  }
  return input as Record<string, unknown>;
}

export function textInput(input: unknown, label: string, maximum: number, required = true): string {
  if (typeof input !== 'string') {
    if (!required && input === undefined) return '';
    throw new BadRequestException(`${label}必须是文本`);
  }
  const value = input.trim();
  if ((required && !value) || value.length > maximum) {
    throw new BadRequestException(`${label}${required ? '不能为空，且' : ''}不能超过 ${maximum} 个字符`);
  }
  return value;
}

export function integerInput(input: unknown, label: string, minimum = 1, maximum = 2147483647): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < minimum || input > maximum) {
    throw new BadRequestException(`${label}必须是 ${minimum} 到 ${maximum} 之间的整数`);
  }
  return input;
}

function listInput(input: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(input) || input.length > maximum) {
    throw new BadRequestException(`${label}必须是数组，最多 ${maximum} 项`);
  }
  return input;
}

export function categoryInput(input: unknown) {
  const body = objectInput(input);
  return {
    name: textInput(body.name, '分类名称', 100),
    description: textInput(body.description, '分类说明', 2000, false),
    parentId: body.parentId === null || body.parentId === undefined
      ? null
      : integerInput(body.parentId, '父分类 ID'),
  };
}

export function pointInput(input: unknown) {
  const body = objectInput(input);
  const note = objectInput(body.note ?? {});
  const questions = listInput(body.questions ?? [], '题目', 50).map((inputQuestion, sortOrder) => {
    const question = objectInput(inputQuestion);
    const options = listInput(question.options, '选项', 8)
      .map((option) => textInput(option, '选项', 1000));
    if (options.length < 2 || new Set(options).size !== options.length) {
      throw new BadRequestException('每道单选题需要 2 到 8 个不重复选项');
    }
    const answer = textInput(question.answer, '正确答案', 1000);
    if (!options.includes(answer)) {
      throw new BadRequestException('正确答案必须是其中一个选项');
    }
    return {
      prompt: textInput(question.prompt, '题干', 5000),
      options,
      answer,
      explanation: textInput(question.explanation, '答案解析', 5000, false),
      sortOrder,
    };
  });
  const examples = listInput(body.examples ?? [], '代码示例', 30).map((inputExample, sortOrder) => {
    const example = objectInput(inputExample);
    const language = textInput(example.language, '代码语言', 30);
    if (!['javascript', 'html', 'css', 'vue', 'typescript', 'text'].includes(language)) {
      throw new BadRequestException('暂不支持该代码语言');
    }
    if (typeof example.runnable !== 'boolean') {
      throw new BadRequestException('是否可运行必须是布尔值');
    }
    if (example.runnable && !['javascript', 'html', 'css', 'vue'].includes(language)) {
      throw new BadRequestException('该语言暂不支持浏览器运行');
    }
    return {
      title: textInput(example.title, '示例标题', 200),
      description: textInput(example.description, '示例说明', 5000, false),
      language,
      code: textInput(example.code, '代码', 60000),
      runnable: example.runnable,
      sortOrder,
    };
  });
  return {
    title: textInput(body.title, '知识点标题', 200),
    categoryId: integerInput(body.categoryId, '分类 ID'),
    summary: textInput(body.summary, '知识点摘要', 5000, false),
    note: {
      keyPoints: textInput(note.keyPoints, '核心要点', 60000, false),
      body: textInput(note.body, '学习笔记', 60000, false),
    },
    questions,
    examples,
  };
}
