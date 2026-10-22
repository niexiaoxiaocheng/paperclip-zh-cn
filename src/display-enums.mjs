// Called only at display boundaries for structured role/status fields. Form
// values, network payloads, comparisons and arbitrary user text stay original.
const labels={
  owner:'组织所有者', admin:'管理员', member:'成员', operator:'操作员', viewer:'查看者',
  ceo:'负责人', cto:'技术负责人', engineer:'工程师', designer:'设计师', pm:'项目经理',
  qa:'测试', devops:'运维', researcher:'研究员', general:'通用',
  active:'活跃', inactive:'未启用', enabled:'已启用', disabled:'已禁用',
  idle:'空闲', running:'运行中', paused:'已暂停', stopped:'已停止',
  pending:'待处理', pending_approval:'等待审批', queued:'排队中',
  succeeded:'成功', failed:'失败', error:'错误', cancelled:'已取消', terminated:'已终止',
  backlog:'待规划', todo:'待办', in_progress:'进行中', in_review:'审阅中',
  blocked:'已阻塞', done:'已完成', completed:'已完成', draft:'草稿',
  open:'未完成', closed:'已关闭', approved:'已批准', rejected:'已拒绝',
  archived:'已归档', connected:'已连接', disconnected:'已断开', expired:'已过期',
  ready:'就绪', needs_setup:'需要设置', revoked:'已撤销', invited:'已邀请',
  unset:'未设置', none:'无', waiting:'等待中', in_queue:'排队中',
};
export function displayEnum(value) {
  if (typeof value!=='string') return value;
  const key=value.toLowerCase().replace(/[ -]/g,'_');
  return Object.hasOwn(labels,key) ? labels[key] : value;
}
