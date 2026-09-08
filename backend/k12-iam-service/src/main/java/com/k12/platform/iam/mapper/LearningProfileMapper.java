package com.k12.platform.iam.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.iam.model.LearningProfile;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface LearningProfileMapper extends BaseMapper<LearningProfile> {
    int upsert(LearningProfile profile);
}
