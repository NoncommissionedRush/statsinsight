"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeModule = void 0;
const common_1 = require("@nestjs/common");
const analyze_controller_1 = require("./analyze.controller");
const analyze_service_1 = require("./analyze.service");
const catalog_module_1 = require("../catalog/catalog.module");
const real_estate_analysis_module_1 = require("../real-estate-analysis/real-estate-analysis.module");
const trade_analysis_module_1 = require("../trade-analysis/trade-analysis.module");
let AnalyzeModule = class AnalyzeModule {
};
exports.AnalyzeModule = AnalyzeModule;
exports.AnalyzeModule = AnalyzeModule = __decorate([
    (0, common_1.Module)({
        imports: [catalog_module_1.CatalogModule, real_estate_analysis_module_1.RealEstateAnalysisModule, trade_analysis_module_1.TradeAnalysisModule],
        controllers: [analyze_controller_1.AnalyzeController],
        providers: [analyze_service_1.AnalyzeService],
    })
], AnalyzeModule);
//# sourceMappingURL=analyze.module.js.map