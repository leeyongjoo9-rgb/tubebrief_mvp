-- TubeBrief 구독 모델 도입.
-- 한 채널에서 특정 코너(제목 키워드 필터)만 구독할 수 있도록 channels 와 videos 사이에
-- subscriptions 레이어를 둔다. 김작가 TV 같은 "전체 구독" 케이스도 빈 키워드 배열로 표현.

create table subscriptions (
  id                uuid primary key default gen_random_uuid(),
  channel_id        text not null references channels(channel_id) on delete cascade,
  label             text,                       -- 사용자 표시용 이름. 예: "뉴스하이킥 - 곽상준"
  include_keywords  text[] not null default '{}', -- 영상 제목에 모두 포함되면 매치 (AND). 빈 배열 = 전체 매치.
  exclude_keywords  text[] not null default '{}', -- 하나라도 포함되면 제외.
  created_at        timestamptz default now(),
  last_checked      timestamptz                  -- 마지막 RSS 폴링 시각 (구독별 추적)
);

create index subscriptions_channel_id_idx on subscriptions(channel_id);

-- 기존 채널을 모두 "전체 구독" 으로 자동 이전.
insert into subscriptions (channel_id, label, include_keywords, exclude_keywords)
select channel_id, title, '{}', '{}'
from channels;

-- (참고) 영상은 여전히 channel_id 로만 묶이므로 videos 테이블은 변경 없음.
-- 한 채널의 여러 구독이 같은 영상을 매치할 수 있지만, video_id UNIQUE 제약으로 중복 저장은 막힘.
