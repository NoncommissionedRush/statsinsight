"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealEstateAnalysisModule = void 0;
const common_1 = require("@nestjs/common");
const cache_module_1 = require("../cache/cache.module");
const real_estate_analysis_controller_1 = require("./real-estate-analysis.controller");
const real_estate_analysis_service_1 = require("./real-estate-analysis.service");
let RealEstateAnalysisModule = class RealEstateAnalysisModule {
};
exports.RealEstateAnalysisModule = RealEstateAnalysisModule;
exports.RealEstateAnalysisModule = RealEstateAnalysisModule = __decorate([
    (0, common_1.Module)({
        imports: [cache_module_1.CacheModule],
        controllers: [real_estate_analysis_controller_1.RealEstateAnalysisController],
        providers: [real_estate_analysis_service_1.RealEstateAnalysisService],
        exports: [real_estate_analysis_service_1.RealEstateAnalysisService],
    })
], RealEstateAnalysisModule);
//# sourceMappingURL=real-estate-analysis.module.js.map