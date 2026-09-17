package com.k12.platform.iam.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.iam.model.LearningProfile;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface LearningProfileMapper extends BaseMapper<LearningProfile> {

    /* MySQL 主键冲突时更新原记录，实现“首次创建、以后修改”的统一入口。 */
    int upsert(LearningProfile profile);
}
