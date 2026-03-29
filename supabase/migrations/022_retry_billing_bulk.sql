-- 022_retry_billing_bulk.sql
-- 미수납 일괄 재청구: billing_log ID 배열을 받아 순차 처리
-- 개별 실패는 건너뛰고 전체 결과를 JSON으로 반환

CREATE OR REPLACE FUNCTION retry_billing_bulk(log_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_id            UUID;
  v_success_count INT := 0;
  v_fail_count    INT := 0;
  v_fail_reasons  JSONB := '[]'::JSONB;
  v_result        JSON;
BEGIN
  FOREACH v_id IN ARRAY log_ids LOOP
    BEGIN
      SELECT retry_billing(v_id) INTO v_result;
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail_count   := v_fail_count + 1;
      v_fail_reasons := v_fail_reasons || jsonb_build_object('id', v_id, 'reason', SQLERRM);
    END;
  END LOOP;

  RETURN json_build_object(
    'total',    array_length(log_ids, 1),
    'success',  v_success_count,
    'failed',   v_fail_count,
    'failures', v_fail_reasons
  );
END;
$func$;
