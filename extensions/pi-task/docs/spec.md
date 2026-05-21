# pi-task Spec

Status: IMPLEMENTED

## User Request AS-IS

```text
explore, create goal, make plans, work in tdd, commit well, do actual manual qa ulw

여기 다른 pi-* 레포지토리처럼 git init, github public repo creation, ci, gh description, gh tagging, readme, docsing

../pi-mono 의 익스텐션도 참고하고, 주로 ../opencode ../omo 그리고 ../free-code 참고해서

task() 도구를 설계하고 만들어주세요. 설계도도 문서로 만들어두고 같이 커밋해두고 그거대로 개발하신 뒤에 외부 에이전트가 확실히 계획서대로 오차없이 다 만들어졌다고 말할떄까지 작업을 진행하세요

이 task 도구는 background, subagent type (category 는 없어도됨, 그리고 기본값이라는 개념도 있어야하는데, 이거는 ../free-code 참고하셈) 이런개념들이 있어야 하고,
~/.senpi/agents/agents 같은곳에서 opencode 와 비슷한 느낌으로 스키마를 잡아주시면 됩니다

그리고 task 도구는 설정에 따라서 in-process 로 서브에이전트 에이전트 루프를 만들지, 별도 프로세스로 서브에이전트 루프로 만들지를 결정할 수 있으며, 기본적으로는 인 프로세스로 돌아야 합니다.
그리고 free-code 가 그렇듯 화면에 잘 띄워지게 해주시고 현황이나 이런거를, 정보가 전반적으로 필요한 정보들이 뭐일지 고민하고 다른애들은 뭘 보여주는지를 고민하고 이게 실시간으로 화면에 잘 보여질 수 있도록 해주세요. 그리고 제가 부탁하고 싶은건, 만약 별도 프로세스 모드로 돌 경우, 별도 프로세스를 직접 죽이게 되면 그것이 잘 감지가 되어야 합니다. 그리고 pid 가 잘 떠야하고, 운영체제 상관없이 다 잘 돌아야합니다. 그런 설계를 해주셔야 합니다.
그리고 activity monitor 에서 어떤 서브에이전트가 어디를 통해서 어떤게 띄워졌고 어떤건지를 볼 수 있어야합니다

모드에 상관없이 서브에이전트를 tui 상에서 직접 죽일수도 있어야하고, 이는 키보드 마우스 다 잘 지원되어야 합니다 직관적인 ux 와 함께. 이것도 깊게 고려해주세요 외부 전문가 호출해서요.

오픈코드 마냥 parent session 이라는 개념이 있어서 이거를 추적 할 수 있어야하고, opencode 마냥 서브가 서브를 가질 수 도 있으나 이러한것들에 대한 깊이도 정할 수 있어야합니다(기본은 1) - 그리고 나중에는 뭐 에이전트 정책에 따라서 다른애들 얘네중에서만 호출할 수 있다 이런것도 agents 의 md frontmatter 에서 정의가 가능해야합니다. 예를들어서, finder 라는 에이전트가 있고 frontmatter 에 호출가능한 서브에이전트 목록이 정의돼있고, 그 안에 github-librarian, web-librarian 이렇게 정의되어있다면 이거는 무조건 호출이 가능함을 의미합니다. (뎁스가 1이더라도, 이것이 더 우선함)

그리고 도구 호출에 대한 권한 관리의 경우 퍼미션 관련 ../senpi 에 정의된게 있는데 이거가 있으면 같이 쓸 수 있도록 하게하는 그런느낌이었으면 좋겠고
백그라운드로 뭔가 에이전트들이 뒤에서 돌고있을경우 이거에 대한 상태값을 잘 표현해줄 수 있어야하며, 여전히 돌고있거나, 아니면 에이전트가 돌다가 내부적으로 에러가 났거나에 대한 것들도 잘 다룰수있도록 해주세요
그리고 model 의 경우 정의되지않으면 부모를 따라가지만, models: [a, b, c] 이렇게 정의한다면 a 가 돌다가 실패하면 폴백으로 b 로 전환되는 그런게 있어야 합니다. 전환의 경우 세션 도중에 모델을 바꿔서 재시도하는 느낌으로 되어야 합니다.

그리고 또한 설정에서 / 혹은 코드로써도 에이전트를 정의해줄수도 있는 느낌이어야해요 pi sdk extension api 뭐 이런거 다 보고 opencode 도 예시로 다 봐주세요

조사해야할게 많고 봐야할게 많고 하니, 일단은 explorer 를 병렬로 6개 뭐 이렇게 요소별로 잔뜩 본 뒤에 모두 합쳐서 합친 조사 내용을 기록하고, 플래닝에이전트 소환해서 플래닝하면서 스펙문서 확실히 적어두고 그 안에다가 제가 말한거 as is 로도 꼭 적어두고

qa 를 어떻게할것인지 qa plan 도 넣어주고 그 실제로 모듈만 임포트해서 어떻게 테스트할건지 이런것도 꼭 봐주시고요. 그리고 실제로 그거대로 qa 한 내용도 안에 다 기록을 해주셔야해요.

다양한 모델이 필요하다면 ~/.config/opencode/opencode.json 의 인증정보나 ~/.senpi 안에있는 인증정보들도 참고해서 직접 가져다 쓰셔도 좋습니다

제가 말한게 길었으니 꼭 외부 플래닝에이전트 호출해서 스펙 명확히 한뒤에 제 말도 그 as-is 로 그대로 적어주세요. 당신과 서브에이전트는 지금부터 계속 영어만 쓰고 최종 결과로만 한국어 쓰세요. 이거 다 하고 나서 ~/.senpi 에 로컬로 설치도 해주세요- 다른애들처럼
```

## Product-Critical Emphasis

```text
꼭 백그라운드 에이전트 잘 관리해주고 오류시에도 메인 에이전트가 잘 인지할 수 있게 해주고 최종응답도 잘 볼 수 있게해줘야함 그게 핵심이다
```

Additional requirements:

- Resume must be supported.
- If a process disappears or the child process itself exits unexpectedly, the parent must see a truthful terminal state and explanation.
- Pi lifecycle and tool events must be mapped intentionally, with structured logs that make background task state, errors, final responses, resume, and abrupt process disappearance auditable.

## Follow-up Corrections Implemented In 0.1.4

```text
task
Started background task task_mp83vlqo_1. Use task_status to inspect it.

그리고 이렇게 tui 에 뜨는데 ../opencode 마냥 어떤 서브에이전트를 어떤 모델로 했고 지금 상태나 이런것도 그 tui 쪽 푸터 안에 그 액티브하게 다 제대로 띄워줘야지 지금시발..
```

```text
pi exiting due to uncaughtException:
InvalidTaskTransitionError: Invalid task transition: cancelled -> failed
```

```text
tasks:2 done:2 이것도 내가 패런트 세션 아니고 아예 새세션열었는데잘못뜸 시발
```

```text
그리고 메인세션에서 포크가되는건아니지 항상 ? 그거아니다 별도 콘텍스트가맞다?
그리고 서브에이전트 세션을 /resume 으로 볼 수 있으면 안됨 이거는 아님 ..
```

Implemented behavior:

- Background launch output now includes agent, execution mode, and model when known.
- Footer/widget rows are scoped to the current parent/root session and include active task metadata.
- In-process children use an in-memory isolated session, do not fork parent chat history, and cannot appear in `/resume`.
- Process children run with `--no-session` and do not fork parent chat history.
- Agent tool rules become child active-tool allowlists for both in-process and process mode.
- Cancellation is terminal; late runner failures are logged without crashing the parent.
